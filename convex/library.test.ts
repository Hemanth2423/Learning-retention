import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const at = (key: string, title: string, page: number) => ({ key, title, level: 1, locator: { kind: "pdf" as const, page } });

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const book = (title: string, extra: Record<string, unknown> = {}) =>
    t.run(async (ctx) => {
      const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
      return await ctx.db.insert("documents", { userId: userA, title, sourceType: "pdf", fileId, status: "ready", pageCount: 30, ...extra });
    });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), book };
}

afterEach(() => vi.useRealTimers());

describe("library", () => {
  test("lists only my books, most recently read first, with the chapter I'm in", async () => {
    const { asA, asB, book } = await setup();
    await book("Unread");
    const reading = await book("Reading", { sections: [at("s0", "One", 1), at("s1", "Two", 10), at("s2", "Three", 20)] });
    await asA.mutation(api.documents.saveProgress, { documentId: reading, page: 12 });
    const list = await asA.query(api.documents.list, {});
    expect(list.map((b) => b.title)).toEqual(["Reading", "Unread"]);
    expect(list[0]).toMatchObject({ page: 12, chapterNumber: 2, chapterTitle: "Two", pageCount: 30 });
    expect(list[1]).toMatchObject({ page: null, chapterNumber: null });
    expect(await asB.query(api.documents.list, {})).toEqual([]);
  });

  test("rename trims, checks length, and is owner-only", async () => {
    const { t, asA, asB, book } = await setup();
    const id = await book("Old name");
    await asA.mutation(api.documents.rename, { documentId: id, title: "  New name  " });
    expect((await t.run((ctx) => ctx.db.get(id)))?.title).toBe("New name");
    await expect(asA.mutation(api.documents.rename, { documentId: id, title: "  " })).rejects.toThrow(/title/);
    await asB.mutation(api.documents.rename, { documentId: id, title: "Hijack" });
    expect((await t.run((ctx) => ctx.db.get(id)))?.title).toBe("New name");
  });

  test("remove deletes the book and, in the background, everything made from it", async () => {
    vi.useFakeTimers();
    const { t, asA, asB, book } = await setup();
    const keep = await book("Keep");
    const gone = await book("Gone", { sections: [at("s0", "One", 1), at("s1", "Two", 10), at("s2", "Three", 20)] });
    await t.run(async (ctx) => {
      const userId = (await ctx.db.get(gone))!.userId;
      for (const documentId of [gone, keep]) {
        await ctx.db.insert("chunks", { documentId, userId, index: 0, text: "page", locator: { kind: "pdf", page: 1 } });
        await ctx.db.insert("highlights", { documentId, userId, locator: { kind: "pdf", page: 1 }, text: "x", segments: [{ page: 1, rects: [{ x: 0, y: 0, w: 0.1, h: 0.01 }] }] });
        await ctx.db.insert("reflections", { documentId, userId, sectionKey: "s0", plainText: "note" });
        await ctx.db.insert("chatMessages", { documentId, userId, role: "user", text: "hi" });
      }
    });
    await asB.mutation(api.documents.remove, { documentId: gone });
    expect(await t.run((ctx) => ctx.db.get(gone))).not.toBeNull(); // not the owner: nothing happens

    await asA.mutation(api.documents.remove, { documentId: gone });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(gone))).toBeNull();
    const left = await t.run(async (ctx) => ({
      chunks: (await ctx.db.query("chunks").collect()).map((r) => r.documentId),
      highlights: (await ctx.db.query("highlights").collect()).map((r) => r.documentId),
      reflections: (await ctx.db.query("reflections").collect()).map((r) => r.documentId),
      chat: (await ctx.db.query("chatMessages").collect()).map((r) => r.documentId),
    }));
    expect(left).toEqual({ chunks: [keep], highlights: [keep], reflections: [keep], chat: [keep] });
    expect((await asA.query(api.documents.list, {})).map((b) => b.title)).toEqual(["Keep"]);
  });

  test("saving progress records pages seen; the library shows % of pages seen", async () => {
    const { t, asA, asB, book } = await setup();
    const id = await book("Seen", { pageCount: 10 });
    await asA.mutation(api.documents.saveProgress, { documentId: id, page: 3, seen: [1, 2, 3, 99] });
    await asA.mutation(api.documents.saveProgress, { documentId: id, page: 4, seen: [4] });
    await asB.mutation(api.documents.saveProgress, { documentId: id, page: 9, seen: [5, 6, 7, 8, 9, 10] });
    expect((await t.run((ctx) => ctx.db.get(id)))?.pagesSeen).toBe("1111000000");
    expect((await asA.query(api.documents.list, {}))[0]).toMatchObject({ progress: 40, page: 4 });
  });
});
