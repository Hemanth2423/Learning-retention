import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { PAGE_GONE } from "./notionRules";
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
    const noteId = await ctx.db.insert("notes", {
      userId, documentId, sectionKey: "part-1", content: "{}", plainText: "First note", updatedAt: 1,
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

async function connectedReader(books = 1) {
  const app = convexTest(schema, modules);
  const { userId, documentIds } = await app.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const documentIds = [];
    for (let i = 0; i < books; i++) {
      documentIds.push(await ctx.db.insert("documents", {
        userId, fileId, title: `Book ${i}`, sourceType: "pdf", status: "ready", pageCount: 20,
      }));
    }
    await ctx.db.insert("integrations", { userId, provider: "notion", accessToken: "test", accountName: "A workspace" });
    return { userId, documentIds };
  });
  return { app, userId, documentIds, reader: app.withIdentity({ subject: userId }) };
}

const savedRow = (userId: Id<"users">, documentId: Id<"documents">, remoteId: string) => ({
  userId, documentId, provider: "notion" as const, parentId: "parent", remoteId,
  url: remoteId ? `https://www.notion.so/${remoteId}` : "", lastSentAt: remoteId ? 1 : 0,
});

it("keeps Notion connected and asks for a new page when one book's page is gone", async () => {
  const { app, userId, documentIds: [gone, other], reader } = await connectedReader(2);
  await app.run(async (ctx) => {
    await ctx.db.insert("exportTargets", savedRow(userId, gone, "gone-page"));
    await ctx.db.insert("exportTargets", savedRow(userId, other, "other-page"));
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));

  await expect(reader.action(api.notion.send, { documentId: gone })).resolves.toEqual({ ok: false, message: PAGE_GONE });

  expect(await reader.query(api.notionData.connection, {})).toEqual({ connected: true, workspaceName: "A workspace" });
  expect(await reader.query(api.notionData.savedTarget, { documentId: gone })).toBeNull();
  expect(await reader.query(api.notionData.savedTarget, { documentId: other })).not.toBeNull();
});

it("still finishes a send when a block was already removed in Notion", async () => {
  const { app, userId, documentIds: [documentId], reader } = await connectedReader();
  await app.run((ctx) => ctx.db.insert("exportTargets", savedRow(userId, documentId, "book")));
  vi.stubGlobal("fetch", vi.fn(async (_input: string, init: RequestInit) => {
    if (init.method === "GET") return Response.json({ results: [{ id: "removed" }], next_cursor: null });
    if (init.method === "DELETE") return new Response("{}", { status: 404 });
    return Response.json({});
  }));

  await expect(reader.action(api.notion.send, { documentId })).resolves.toMatchObject({ ok: true });
  expect(await reader.query(api.notionData.savedTarget, { documentId })).not.toBeNull();
});

it("blocks a second send while one is running, but recovers once it has clearly died", async () => {
  const { app, userId, documentIds: [documentId], reader } = await connectedReader();
  await app.run((ctx) => ctx.db.insert("exportTargets", savedRow(userId, documentId, "")));
  vi.stubGlobal("fetch", vi.fn(async (input: string) =>
    Response.json(input.endsWith("/pages") ? { id: "new-page", url: "https://www.notion.so/new-page" } : {})));

  await expect(reader.action(api.notion.send, { documentId, parentId: "parent" })).resolves.toMatchObject({ ok: false });
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60 * 1000);
  await expect(reader.action(api.notion.send, { documentId, parentId: "parent" })).resolves.toMatchObject({
    ok: true, url: "https://www.notion.so/new-page",
  });
});

it("doesn't offer a book's own export page as a place to send to", async () => {
  const { app, userId, documentIds: [documentId], reader } = await connectedReader();
  await app.run((ctx) => ctx.db.insert("exportTargets", savedRow(userId, documentId, "exported")));
  const page = (id: string) => ({ id, properties: { title: { type: "title", title: [{ plain_text: id }] } } });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ results: [page("exported"), page("chosen")], next_cursor: null })));

  await expect(reader.action(api.notion.listPages, {})).resolves.toEqual({ ok: true, pages: [{ id: "chosen", title: "chosen" }] });
});
