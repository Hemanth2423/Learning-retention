import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const at = (key: string, title: string, page: number) => ({ key, title, level: 1, locator: { kind: "pdf" as const, page } });

async function setup(hasText = true) {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const documentId = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const id = await ctx.db.insert("documents", {
      userId: userA,
      title: "Book",
      sourceType: "pdf",
      fileId,
      status: "ready",
      pageCount: 6,
      hasText,
      sections: [at("s0", "One", 1), at("s1", "Two", 4)],
    });
    for (let i = 0; i < 6; i++) await ctx.db.insert("chunks", { documentId: id, userId: userA, index: i, text: `Page ${i + 1} text about habits.`, locator: { kind: "pdf", page: i + 1 } });
    return id;
  });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId };
}

const question = (n: number) => ({
  question: `Question ${n}?`,
  correct: `Right ${n}`,
  wrong: [
    { option: `Wrong A${n}`, why: `A${n} is tempting.` },
    { option: `Wrong B${n}`, why: `B${n} is tempting.` },
    { option: `Wrong C${n}`, why: `C${n} is tempting.` },
  ],
  explanation: `Explained ${n}.`,
  page: 2,
});

function mockAi(reply: unknown) {
  const fetchMock = vi.fn<(url: string, init?: { body?: string }) => Promise<Response>>(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: {} }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "test";
  delete process.env.LLM_PROVIDER;
});
afterEach(() => vi.unstubAllGlobals());

async function ready() {
  const s = await setup();
  const ai = mockAi({ questions: [1, 2, 3, 4, 5, 6].map(question) });
  expect(await s.asA.action(api.quizzes.prepare, { documentId: s.documentId, chapterKey: "s0" })).toEqual({ ok: true });
  const quiz = (await s.asA.query(api.quizzes.get, { documentId: s.documentId, chapterKey: "s0" }))!;
  return { ...s, ai, quiz };
}

describe("quizzes", () => {
  test("the first Test yourself makes 5 questions from that chapter's pages only, without answers in the browser", async () => {
    const { ai, quiz, asA, documentId } = await ready();
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.best).toBeNull();
    expect(JSON.stringify(quiz)).not.toMatch(/answer|whyWrong|explanation/);
    const prompt = String(ai.mock.calls[0][1]?.body);
    expect(prompt).toContain("Page 1 text");
    expect(prompt).not.toContain("Page 4 text"); // chapter s1's pages are left out
    expect(await asA.query(api.chat.quota, {})).toMatchObject({ left: 4 });
    expect(await asA.query(api.chat.history, { documentId })).toEqual([]); // not shown in the chat
  });

  test("making it again is free and reuses the same test", async () => {
    const { asA, documentId, ai, quiz } = await ready();
    expect(await asA.action(api.quizzes.prepare, { documentId, chapterKey: "s0" })).toEqual({ ok: true });
    expect(ai).toHaveBeenCalledTimes(1);
    expect((await asA.query(api.quizzes.get, { documentId, chapterKey: "s0" }))!.quizId).toBe(quiz.quizId);
    expect(await asA.query(api.chat.quota, {})).toMatchObject({ left: 4 });
  });

  test("an unusable AI reply doesn't use up a question", async () => {
    const { asA, documentId } = await setup();
    mockAi({ questions: [question(1)] });
    const res = await asA.action(api.quizzes.prepare, { documentId, chapterKey: "s0" });
    expect(res.ok).toBe(false);
    expect(await asA.query(api.chat.quota, {})).toMatchObject({ left: 5 });
    expect(await asA.query(api.quizzes.get, { documentId, chapterKey: "s0" })).toBeNull();
  });

  test("scanned books and other people's books can't be tested", async () => {
    const scanned = await setup(false);
    mockAi({ questions: [1, 2, 3, 4, 5].map(question) });
    expect(await scanned.asA.action(api.quizzes.prepare, { documentId: scanned.documentId, chapterKey: "s0" })).toMatchObject({ ok: false });
    const { asB, documentId, quiz } = await ready();
    expect(await asB.action(api.quizzes.prepare, { documentId, chapterKey: "s0" })).toEqual({ ok: true }); // already made, but…
    expect(await asB.query(api.quizzes.get, { documentId, chapterKey: "s0" })).toBeNull();
    await expect(asB.mutation(api.quizzes.start, { quizId: quiz.quizId, review: false })).rejects.toThrow();
  });

  test("answers are graded on the server, once each, and the best full score is kept", async () => {
    const { asA, documentId, quiz, t } = await ready();
    const stored = await t.run(async (ctx) => (await ctx.db.get(quiz.quizId))!.questions);
    const { attemptId, indices } = await asA.mutation(api.quizzes.start, { quizId: quiz.quizId, review: false });
    expect(indices).toEqual([0, 1, 2, 3, 4]);

    const wrongOf = (i: number) => (stored[i].answer + 1) % 4;
    const first = await asA.mutation(api.quizzes.answer, { attemptId, position: 0, choice: wrongOf(0) });
    expect(first).toMatchObject({ correct: false, answer: stored[0].answer, finished: false });
    expect(first.whyWrong).toMatch(/is tempting/);
    await expect(asA.mutation(api.quizzes.answer, { attemptId, position: 0, choice: stored[0].answer })).rejects.toThrow("Already answered");
    await expect(asA.mutation(api.quizzes.answer, { attemptId, position: 1, choice: 7 })).rejects.toThrow();

    for (const p of [1, 2, 3]) await asA.mutation(api.quizzes.answer, { attemptId, position: p, choice: stored[p].answer });
    const last = await asA.mutation(api.quizzes.answer, { attemptId, position: 4, choice: wrongOf(4) });
    expect(last).toMatchObject({ finished: true, score: 3, missed: 2 });
    expect((await asA.query(api.quizzes.get, { documentId, chapterKey: "s0" }))!.best).toBe(3);
    expect(await asA.query(api.quizzes.bestScores, { documentId })).toEqual({ s0: { best: 3, total: 5 } });

    // Review re-asks only the 2 missed; a perfect review doesn't raise the best score.
    const review = await asA.mutation(api.quizzes.start, { quizId: quiz.quizId, review: true });
    expect(review.indices).toEqual([0, 4]);
    for (const [p, i] of review.indices.entries()) await asA.mutation(api.quizzes.answer, { attemptId: review.attemptId, position: p, choice: stored[i].answer });
    expect((await asA.query(api.quizzes.get, { documentId, chapterKey: "s0" }))!.best).toBe(3);
    await expect(asA.mutation(api.quizzes.start, { quizId: quiz.quizId, review: true })).rejects.toThrow("Nothing to review");
  });

  test("removing the book removes its tests", async () => {
    const { asA, documentId, t, quiz } = await ready();
    await asA.mutation(api.quizzes.start, { quizId: quiz.quizId, review: false });
    vi.useFakeTimers();
    await asA.mutation(api.documents.remove, { documentId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();
    const left = await t.run(async (ctx) => [(await ctx.db.query("quizzes").collect()).length, (await ctx.db.query("quizAttempts").collect()).length]);
    expect(left).toEqual([0, 0]);
  });
});
