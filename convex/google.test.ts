import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { modules } from "./test.setup";

const connect = makeFunctionReference<"action">("google:connect");
const send = makeFunctionReference<"action">("google:send");
const connection = makeFunctionReference<"query">("googleData:connection");
const savedTarget = makeFunctionReference<"query">("googleData:savedTarget");

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "client";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  process.env.CONVEX_SITE_URL = "https://example.convex.site";
  process.env.SITE_URL = "https://ingrain.example";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.CONVEX_SITE_URL;
  delete process.env.SITE_URL;
});

async function seedBook(app: ReturnType<typeof convexTest>, options: { expired?: boolean } = {}) {
  return app.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const documentId = await ctx.db.insert("documents", {
      userId,
      fileId,
      title: "A book",
      sourceType: "pdf",
      status: "ready",
      pageCount: 20,
      sections: [
        { key: "chapter-1", title: "Chapter 1", level: 1, locator: { kind: "pdf", page: 1 } },
        { key: "chapter-2", title: "Chapter 2", level: 1, locator: { kind: "pdf", page: 11 } },
      ],
    });
    const noteId = await ctx.db.insert("reflections", {
      userId,
      documentId,
      sectionKey: "chapter-2",
      plainText: "<strong>This stays text</strong>",
    });
    await ctx.db.insert("highlights", {
      userId,
      documentId,
      locator: { kind: "pdf", page: 3 },
      text: "A useful idea",
      comment: "Remember this",
      segments: [],
    });
    await ctx.db.insert("integrations", {
      userId,
      provider: "google",
      accessToken: "old-access",
      refreshToken: "refresh-token",
      expiresAt: options.expired ? 1 : Date.now() + 3_600_000,
      accountName: "Google Drive",
    });
    return { userId, documentId, noteId };
  });
}

function inputUrl(input: string | URL | Request) {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

describe("Google Docs export", () => {
  it("creates one Doc, keeps chapter order, saves its link, and updates the same Doc after an edit", async () => {
    const app = convexTest(schema, modules);
    const { userId, documentId, noteId } = await seedBook(app);
    const docUrl = "https://docs.google.com/document/d/doc-1/edit";
    const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = inputUrl(input);
      const method = init.method ?? "GET";
      if (url.includes("/drive/v3/files?") && method === "GET") return Response.json({ files: [] });
      if (url.includes("/drive/v3/files?") && method === "POST") {
        const body = JSON.parse(String(init.body));
        return Response.json(body.mimeType === "application/vnd.google-apps.folder"
          ? { id: "folder-1" }
          : { id: "doc-1", webViewLink: docUrl });
      }
      if (url.includes("/documents/doc-1?fields=") && method === "GET") {
        return Response.json({ body: { content: [{ endIndex: 80 }] } });
      }
      if (url.endsWith("/documents/doc-1:batchUpdate") && method === "POST") return Response.json({});
      throw new Error(`Unexpected Google request: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const time = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const reader = app.withIdentity({ subject: userId });

    await expect(reader.action(send, { documentId })).resolves.toEqual({ ok: true, url: docUrl });
    expect(await reader.query(savedTarget, { documentId })).toEqual({ url: docUrl, lastSentAt: 1_000 });

    await app.run((ctx) => ctx.db.patch(noteId, { plainText: "My edited <em>note</em>" }));
    time.mockReturnValue(2_000);
    await expect(reader.action(send, { documentId })).resolves.toEqual({ ok: true, url: docUrl });

    const createDocCalls = fetchMock.mock.calls.filter(([input, init]) => {
      if (!inputUrl(input).includes("/drive/v3/files?") || init?.method !== "POST") return false;
      return JSON.parse(String(init.body)).mimeType === "application/vnd.google-apps.document";
    });
    expect(createDocCalls).toHaveLength(1);
    const writes = fetchMock.mock.calls.filter(([input]) => inputUrl(input).endsWith("/documents/doc-1:batchUpdate"));
    expect(writes).toHaveLength(2);
    const secondBody = String(writes[1][1]?.body);
    expect(secondBody).toContain("Chapter 1");
    expect(secondBody).toContain("Remember this");
    expect(secondBody).toContain("Chapter 2");
    expect(secondBody).toContain("My edited <em>note</em>");
    expect(secondBody).toContain("deleteContentRange");
    expect(await reader.query(savedTarget, { documentId })).toEqual({ url: docUrl, lastSentAt: 2_000 });
  });

  it("refreshes an expired access token on the server and preserves the refresh token", async () => {
    const app = convexTest(schema, modules);
    const { userId, documentId } = await seedBook(app, { expired: true });
    const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = inputUrl(input);
      const method = init.method ?? "GET";
      if (url === "https://oauth2.googleapis.com/token") {
        expect(String(init.body)).toContain("refresh_token=refresh-token");
        return Response.json({ access_token: "new-access", expires_in: 3600 });
      }
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer new-access");
      if (url.includes("/drive/v3/files?") && method === "GET") return Response.json({ files: [{ id: "folder-1" }] });
      if (url.includes("/drive/v3/files?") && method === "POST") return Response.json({ id: "doc-1" });
      if (url.endsWith("/documents/doc-1:batchUpdate") && method === "POST") return Response.json({});
      throw new Error(`Unexpected Google request: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(app.withIdentity({ subject: userId }).action(send, { documentId })).resolves.toMatchObject({ ok: true });
    const row = await app.run((ctx) => ctx.db.query("integrations").withIndex("by_user_provider", (q) =>
      q.eq("userId", userId).eq("provider", "google")).unique());
    expect(row).toMatchObject({ accessToken: "new-access", refreshToken: "refresh-token" });
  });

  it("shows Reconnect Google and removes the unusable connection when refresh access is revoked", async () => {
    const app = convexTest(schema, modules);
    const { userId, documentId } = await seedBook(app, { expired: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid_grant", { status: 400 })));

    await expect(app.withIdentity({ subject: userId }).action(send, { documentId })).resolves.toEqual({
      ok: false, message: "Reconnect Google",
    });
    expect(await app.run((ctx) => ctx.db.query("integrations").collect())).toEqual([]);
  });

  it("uses only drive.file and prevents another user from using the connection or book", async () => {
    const app = convexTest(schema, modules);
    const { userId, documentId } = await seedBook(app);
    const otherUserId = await app.run((ctx) => ctx.db.insert("users", {}));
    const owner = app.withIdentity({ subject: userId });
    const other = app.withIdentity({ subject: otherUserId });

    const result = await owner.action(connect, { documentId });
    expect(new URL(result.url).searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    expect(await other.query(connection, {})).toEqual({ connected: false, accountName: null });
    await expect(other.action(connect, { documentId })).rejects.toThrow(/Book not found/);
    await expect(other.action(send, { documentId })).rejects.toThrow(/Book not found/);
  });
});
