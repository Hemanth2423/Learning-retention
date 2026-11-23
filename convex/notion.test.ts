import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("updates the same Notion page and advances the last-sent time after a note changes", async () => {
  const app = convexTest(schema, modules);
  const { userId, documentId, noteId } = await app.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const documentId = await ctx.db.insert("documents", {
      userId, fileId, title: "A book", sourceType: "pdf", status: "ready", pageCount: 20,
    });
    const noteId = await ctx.db.insert("reflections", {
      userId, documentId, sectionKey: "part-1", plainText: "First note",
    });
    await ctx.db.insert("integrations", { userId, provider: "notion", accessToken: "test", accountName: "A workspace" });
    return { userId, documentId, noteId };
  });

  const url = "https://www.notion.so/book";
  const fetchMock = vi.fn(async (input: string, init: RequestInit) => {
    if (input.endsWith("/pages") && init.method === "POST") return Response.json({ id: "book", url });
    if (input.endsWith("/blocks/book/children") && init.method === "GET") {
      return Response.json({ results: [{ id: "old-note" }], next_cursor: null });
    }
    if (input.endsWith("/blocks/book/children") && init.method === "PATCH") return Response.json({});
    if (input.endsWith("/blocks/old-note") && init.method === "DELETE") return Response.json({});
    throw new Error(`Unexpected Notion request: ${init.method} ${input}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const time = vi.spyOn(Date, "now").mockReturnValue(1_000);
  const reader = app.withIdentity({ subject: userId });

  await expect(reader.action(api.notion.send, { documentId, parentId: "parent" })).resolves.toEqual({ ok: true, url });
  const original = await reader.query(api.notionData.savedTarget, { documentId });
  await app.run((ctx) => ctx.db.patch(noteId, { plainText: "My edited note" }));
  time.mockReturnValue(2_000);
  await expect(reader.action(api.notion.send, { documentId })).resolves.toEqual({ ok: true, url });

  expect(fetchMock.mock.calls.filter(([input]) => input.endsWith("/pages"))).toHaveLength(1);
  const writes = fetchMock.mock.calls.filter(([, init]) => init.method === "PATCH");
  expect(writes[1][1].body).toContain("My edited note");
  expect(fetchMock.mock.calls.some(([, init]) => init.method === "DELETE")).toBe(true);
  expect(await reader.query(api.notionData.savedTarget, { documentId })).toEqual({ url: original?.url, lastSentAt: 2_000 });
  const targets = await app.run((ctx) => ctx.db.query("exportTargets").collect());
  expect(targets.map(({ remoteId, lastSentAt }) => ({ remoteId, lastSentAt }))).toEqual([{ remoteId: "book", lastSentAt: 2_000 }]);
});
