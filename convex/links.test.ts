import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const ARTICLE_MD = ["# How to Do Great Work", "", ...Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}: ` + "Curiosity is the best guide to great work. ".repeat(8))].join("\n\n");

// Pretends to be Firecrawl and YouTube: the test checks what Ingrain does with their answers, not the APIs.
function mockApis(opts: { article?: { markdown: string; statusCode?: number; title?: string }; oembed?: number } = {}) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("firecrawl")) {
        const a = opts.article ?? { markdown: ARTICLE_MD };
        return new Response(JSON.stringify({ success: true, data: { markdown: a.markdown, metadata: { title: a.title ?? "How to Do Great Work", statusCode: a.statusCode ?? 200 } } }), { status: 200 });
      }
      if (url.includes("youtube.com/oembed")) {
        if (opts.oembed && opts.oembed !== 200) return new Response("Not Found", { status: opts.oembed });
        return new Response(JSON.stringify({ title: "The first 20 hours", author_name: "TEDx Talks" }), { status: 200 });
      }
      throw new Error("unexpected fetch " + url);
    })
  );
  return calls;
}

async function setup() {
  const t = convexTest(schema, modules);
  const [a, b] = await t.run(async (ctx) => [await ctx.db.insert("users", { email: "a@test.com" }), await ctx.db.insert("users", { email: "b@test.com" })]);
  return { t, asA: t.withIdentity({ subject: a }), asB: t.withIdentity({ subject: b }) };
}
const docsOf = (t: Awaited<ReturnType<typeof setup>>["t"]) => t.run((ctx) => ctx.db.query("documents").collect());

beforeEach(() => {
  process.env.FIRECRAWL_API_KEY = "test";
});
afterEach(() => vi.unstubAllGlobals());

describe("adding articles and videos by link", () => {
  // The team-assignment test (TEAM-PLAN.md): duplicates are refused, even with tracking parameters.
  test("given I already added an article, when I add the same link again with tracking parameters, then I'm told it's already there and no second item is saved", async () => {
    const { t, asA } = await setup();
    const calls = mockApis();
    const first = await asA.action(api.links.add, { url: "https://paulgraham.com/greatwork.html" });
    expect(first.ok).toBe(true);

    const again = await asA.action(api.links.add, { url: "https://www.paulgraham.com/greatwork.html?utm_source=twitter&utm_medium=social#top" });
    expect(again).toMatchObject({ ok: false, message: "That's already in your library.", documentId: first.ok ? first.documentId : undefined });
    expect(await docsOf(t)).toHaveLength(1);
    expect(calls.filter((c) => c.includes("firecrawl"))).toHaveLength(1); // no second paid call either
  });

  test("an article is saved once with its text in blocks, ready for notes and Ask", async () => {
    const { t, asA } = await setup();
    mockApis();
    const res = await asA.action(api.links.add, { url: "paulgraham.com/greatwork.html" });
    const [doc] = await docsOf(t);
    expect(doc).toMatchObject({ sourceType: "article", sourceUrl: "https://paulgraham.com/greatwork.html", title: "How to Do Great Work", siteName: "paulgraham.com", status: "ready", hasText: true });
    expect(doc.sections).toEqual([{ key: "article", title: "How to Do Great Work", level: 1, locator: { kind: "text", page: 1 } }]);
    const chunks = await t.run((ctx) => ctx.db.query("chunks").collect());
    expect(chunks.length).toBe(doc.pageCount);
    expect(chunks[0].locator).toEqual({ kind: "text", page: 1 });
    expect(res).toEqual({ ok: true, documentId: doc._id });
  });

  test("a paywalled page is saved as a link, with a clear message and no text", async () => {
    const { t, asA } = await setup();
    mockApis({ article: { markdown: "Subscribe to keep reading. [Sign in](https://x)", title: "Big News", statusCode: 200 } });
    const res = await asA.action(api.links.add, { url: "https://news.example.com/story" });
    expect(res).toMatchObject({ ok: true, savedAsLink: true });
    const [doc] = await docsOf(t);
    expect(doc).toMatchObject({ title: "Big News", hasText: false, status: "ready" });
    expect(doc.statusMessage).toMatch(/saved as a link/);
  });

  test("a missing page or an unavailable video saves nothing", async () => {
    const { t, asA } = await setup();
    mockApis({ article: { markdown: "", statusCode: 404 }, oembed: 404 });
    expect(await asA.action(api.links.add, { url: "https://example.com/gone" })).toMatchObject({ ok: false });
    expect(await asA.action(api.links.add, { url: "https://youtu.be/5MgBikgcWnY" })).toMatchObject({ ok: false, message: expect.stringMatching(/isn't available/) });
    expect(await docsOf(t)).toHaveLength(0);
  });

  test("a YouTube video is saved with its title, channel and thumbnail; other forms of the link are duplicates", async () => {
    const { t, asA } = await setup();
    mockApis();
    await asA.action(api.links.add, { url: "https://www.youtube.com/watch?v=5MgBikgcWnY&t=30s" });
    expect(await asA.action(api.links.add, { url: "https://youtu.be/5MgBikgcWnY" })).toMatchObject({ ok: false, message: "That's already in your library." });
    const [doc] = await docsOf(t);
    expect(doc).toMatchObject({ sourceType: "video", videoId: "5MgBikgcWnY", title: "The first 20 hours", siteName: "TEDx Talks", imageUrl: "https://i.ytimg.com/vi/5MgBikgcWnY/hqdefault.jpg" });
  });

  test("another reader can add the same link to their own library; bad links are refused", async () => {
    const { t, asA, asB } = await setup();
    mockApis();
    await asA.action(api.links.add, { url: "https://paulgraham.com/greatwork.html" });
    expect((await asB.action(api.links.add, { url: "https://paulgraham.com/greatwork.html" })).ok).toBe(true);
    expect(await docsOf(t)).toHaveLength(2);
    expect(await asA.action(api.links.add, { url: "not a link" })).toMatchObject({ ok: false });
  });
});
