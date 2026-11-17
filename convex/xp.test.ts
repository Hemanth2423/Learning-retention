import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const at = (key: string, title: string, page: number) => ({ key, title, level: 1, locator: { kind: "pdf" as const, page } });
const DAY = 86_400_000;

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "a@test.com" }));
  const documentId = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const id = await ctx.db.insert("documents", {
      userId,
      title: "Book",
      sourceType: "pdf",
      fileId,
      status: "ready",
      pageCount: 6,
      hasText: true,
      sections: [at("s0", "One", 1), at("s1", "Two", 4)],
    });
    for (let i = 0; i < 6; i++) await ctx.db.insert("chunks", { documentId: id, userId, index: i, text: `Page ${i + 1}`, locator: { kind: "pdf", page: i + 1 } });
    return id;
  });
  return { t, as: t.withIdentity({ subject: userId }), documentId };
}

const note = (text: string) => ({ content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }), plainText: text });

beforeEach(() => vi.useFakeTimers({ now: Date.UTC(2026, 10, 17, 18), toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("xp", () => {
  test("starts at zero, level 1, no streak", async () => {
    const { as } = await setup();
    expect(await as.query(api.xp.stats, {})).toEqual({ xp: 0, level: 1, intoLevel: 0, streak: 0 });
  });

  test("reading a whole chapter pays 10 XP, once", async () => {
    const { as, documentId } = await setup();
    await as.mutation(api.documents.saveProgress, { documentId, page: 2, seen: [1, 2] });
    expect((await as.query(api.xp.stats, {})).xp).toBe(0); // chapter not finished yet
    await as.mutation(api.documents.saveProgress, { documentId, page: 3, seen: [3] });
    expect(await as.query(api.xp.stats, {})).toMatchObject({ xp: 10, streak: 1 });
    await as.mutation(api.documents.saveProgress, { documentId, page: 3, seen: [1, 2, 3] });
    await as.mutation(api.documents.saveProgress, { documentId, page: 4, seen: [4] });
    expect((await as.query(api.xp.stats, {})).xp).toBe(10);
  });

  test("a chapter's note pays 20 XP once, even if rewritten or deleted and written again", async () => {
    const { as, documentId } = await setup();
    expect(await as.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("Habits loop.") })).toEqual({ xp: 20 });
    expect(await as.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("Habits loop, better.") })).toEqual({ xp: 0 });
    await as.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("") });
    await as.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("Again.") });
    await as.mutation(api.reflections.save, { documentId, sectionKey: "s1", ...note("Second chapter.") });
    expect((await as.query(api.xp.stats, {})).xp).toBe(40);
  });

  test("each right test answer pays 10 XP the first time only", async () => {
    const { as, documentId, t } = await setup();
    const questions = [0, 1, 2, 3, 4].map((n) => ({ question: `Q${n}?`, options: ["a", "b", "c", "d"], answer: 0, explanation: "e", whyWrong: ["", "x", "y", "z"] }));
    const quizId = await t.run(async (ctx) => {
      const doc = (await ctx.db.get(documentId))!;
      return ctx.db.insert("quizzes", { userId: doc.userId, documentId, chapterKey: "s0", questions });
    });
    const round = await as.mutation(api.quizzes.start, { quizId, review: false });
    const results = [];
    for (const p of [0, 1, 2, 3, 4]) results.push(await as.mutation(api.quizzes.answer, { attemptId: round.attemptId, position: p, choice: p < 3 ? 0 : 1 }));
    expect(results.map((r) => r.xp)).toEqual([10, 10, 10, 0, 0]);

    const again = await as.mutation(api.quizzes.start, { quizId, review: false });
    const retake = [];
    for (const p of [0, 1, 2, 3, 4]) retake.push(await as.mutation(api.quizzes.answer, { attemptId: again.attemptId, position: p, choice: 0 }));
    expect(retake.map((r) => r.xp)).toEqual([0, 0, 0, 10, 10]); // only the two never answered right before
    expect(await as.query(api.xp.stats, {})).toMatchObject({ xp: 50, level: 1, intoLevel: 50 });
  });

  test("streak grows on consecutive days, shows until the next day ends, then restarts", async () => {
    const { as, documentId } = await setup();
    await as.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("Day one.") });
    vi.setSystemTime(Date.now() + DAY);
    await as.mutation(api.reflections.save, { documentId, sectionKey: "s1", ...note("Day two.") });
    expect((await as.query(api.xp.stats, {})).streak).toBe(2);
    vi.setSystemTime(Date.now() + DAY);
    expect((await as.query(api.xp.stats, {})).streak).toBe(2); // still today to keep it going
    vi.setSystemTime(Date.now() + DAY);
    expect((await as.query(api.xp.stats, {})).streak).toBe(0);
    await as.mutation(api.documents.saveProgress, { documentId, page: 3, seen: [1, 2, 3] });
    expect((await as.query(api.xp.stats, {})).streak).toBe(1);
  });

  test("the streak day follows the reader's time zone; a bad zone is ignored", async () => {
    const { as, documentId, t } = await setup();
    await as.mutation(api.xp.setTimeZone, { timeZone: "Not/AZone" });
    expect(await t.run((ctx) => ctx.db.query("learnerStats").collect())).toEqual([]);
    await as.mutation(api.xp.setTimeZone, { timeZone: "America/Los_Angeles" });
    await as.mutation(api.reflections.save, { documentId, sectionKey: "s0", ...note("Note.") });
    const row = (await t.run((ctx) => ctx.db.query("learnerStats").first()))!;
    expect(row).toMatchObject({ timeZone: "America/Los_Angeles", lastActiveDay: "2026-11-17", xp: 20 });
  });
});
