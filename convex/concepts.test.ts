import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const PAGE = "A load balancer evenly distributes incoming traffic among web servers in a pool so that no single machine becomes overloaded during busy periods. ".repeat(4);

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [await ctx.db.insert("users", { email: "a@test.com" }), await ctx.db.insert("users", { email: "b@test.com" })]);
  const documentId = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const id = await ctx.db.insert("documents", { userId: userA, title: "Book", sourceType: "pdf", fileId, status: "ready", pageCount: 2, hasText: true, sections: [{ key: "s0", title: "One", level: 1, locator: { kind: "pdf" as const, page: 1 } }] });
    for (let i = 0; i < 2; i++) await ctx.db.insert("chunks", { documentId: id, userId: userA, index: i, text: PAGE, locator: { kind: "pdf", page: i + 1 } });
    return id;
  });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId };
}

const q = (n: number, ideaId: string, mode: string, difficulty: string) => ({
  ideaId,
  mode,
  difficulty,
  question: `Scenario number ${n}: what should the team decide here?`,
  correct: `Correct decision ${n} for traffic`,
  wrong: [
    { option: `Mistaken choice ${n} about storage`, why: "Storage is different." },
    { option: `Mistaken choice ${n} about caching`, why: "Caching is different." },
    { option: `Mistaken choice ${n} about retries`, why: "Retries are different." },
  ],
  explanation: "It shares traffic.",
  page: 1,
  excerpt: "evenly distributes incoming traffic among web servers",
});
const generated = {
  ideas: [
    { id: "i1", name: "Balancing", objective: "The reader can route traffic", page: 1 },
    { id: "i2", name: "Pools", objective: "The reader can size a pool", page: 2 },
  ],
  questions: ["i1", "i2"].flatMap((id, x) => [q(x * 3 + 1, id, "remember", "core"), q(x * 3 + 2, id, "understand", "stretch"), q(x * 3 + 3, id, "apply", "hard")]),
};

function stubAI() {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const system = JSON.parse(init.body as string).messages[0].content as string;
    const content = system.startsWith("Answer each") ? { answers: [] } : system.startsWith("You map") ? { links: [{ from: "i1", to: "i2", type: "requires", note: "Balancing needs a pool." }, { from: "i1", to: "i9", type: "causes" }] } : generated;
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "test";
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
});

async function ready() {
  const s = await setup();
  stubAI();
  expect(await s.asA.action(api.concepts.prepare, { documentId: s.documentId, chapterKey: "s0" })).toEqual({ ok: true });
  const check = (await s.asA.query(api.concepts.get, { documentId: s.documentId, chapterKey: "s0" }))!;
  return { ...s, check };
}

describe("concept check", () => {
  test("generates a bank, and keys never reach the browser before answering", async () => {
    const { asA, check } = await ready();
    expect(check.ideas).toHaveLength(2);
    expect(check.bankSize).toBeGreaterThan(0);
    const sessionId = await asA.mutation(api.concepts.start, { checkId: check.checkId, kind: "today" });
    const cur = (await asA.query(api.concepts.current, { sessionId }))!;
    expect(JSON.stringify(cur)).not.toMatch(/"answer"|whyWrong|excerpt/);
    expect(cur.feedback).toBeNull();
  });

  test("a duplicate answer changes nothing and reload restores feedback", async () => {
    const { t, asA, check } = await ready();
    const sessionId = await asA.mutation(api.concepts.start, { checkId: check.checkId, kind: "today" });
    const first = await asA.mutation(api.concepts.answer, { sessionId, position: 0, option: 0, confidence: "sure" });
    const again = await asA.mutation(api.concepts.answer, { sessionId, position: 0, option: 1, confidence: "guess" });
    expect(again.chosen).toBe(first.chosen);
    expect(again.confidence).toBe("sure");
    expect(await t.run((ctx) => ctx.db.query("conceptAnswers").collect())).toHaveLength(1);
    expect((await asA.query(api.concepts.current, { sessionId }))!.feedback?.chosen).toBe(0);
  });

  test("another reader can't read or answer", async () => {
    const { asA, asB, check, documentId } = await ready();
    const sessionId = await asA.mutation(api.concepts.start, { checkId: check.checkId, kind: "today" });
    expect(await asB.query(api.concepts.get, { documentId, chapterKey: "s0" })).toBeNull();
    expect(await asB.query(api.concepts.current, { sessionId })).toBeNull();
    await expect(asB.mutation(api.concepts.answer, { sessionId, position: 0, option: 0, confidence: "sure" })).rejects.toThrow();
  });

  test("finishing sets the next check; XP pays once per question", async () => {
    const { t, asA, check } = await ready();
    const sessionId = await asA.mutation(api.concepts.start, { checkId: check.checkId, kind: "today" });
    const total = (await asA.query(api.concepts.current, { sessionId }))!.total;
    for (let position = 0; position < total; position++) {
      const cur = (await asA.query(api.concepts.current, { sessionId }))!;
      const key = await t.run(async (ctx) => (await ctx.db.get(cur.question!.id as Id<"conceptQuestions">))!.answer);
      await asA.mutation(api.concepts.answer, { sessionId, position, option: key, confidence: "sure" });
      await asA.mutation(api.concepts.next, { sessionId, position });
    }
    const res = (await asA.query(api.concepts.result, { sessionId }))!;
    expect(res.right).toBe(total);
    expect(res.xp).toBe(total * 2);
    expect(res.nextCheckAt).toBeTruthy();
  });

  test("a reported question leaves the bank", async () => {
    const { asA, check, documentId } = await ready();
    const sessionId = await asA.mutation(api.concepts.start, { checkId: check.checkId, kind: "today" });
    const cur = (await asA.query(api.concepts.current, { sessionId }))!;
    await asA.mutation(api.concepts.report, { questionId: cur.question!.id, reason: "ambiguous" });
    expect((await asA.query(api.concepts.get, { documentId, chapterKey: "s0" }))!.bankSize).toBe(check.bankSize - 1);
    await asA.mutation(api.concepts.next, { sessionId, position: 0 });
  });

  test("a second prepare during generation makes no AI call", async () => {
    const { t, asA, documentId } = await setup();
    const fetchMock = stubAI();
    await t.run(async (ctx) => {
      const userId = (await ctx.db.get(documentId))!.userId;
      await ctx.db.insert("conceptChecks", { userId, documentId, chapterKey: "s0", ideas: [], batchesDone: 0, generatingBatch: 1, generatingAt: Date.now(), failedTries: 0, sourceHash: "x", coverage: { pagesUsed: 2, pagesTotal: 2 }, solidAwarded: [] });
    });
    expect(await asA.action(api.concepts.prepare, { documentId, chapterKey: "s0" })).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("failures are capped per day", async () => {
    const { asA, documentId } = await setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{}" } }], usage: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 2; i++) expect((await asA.action(api.concepts.prepare, { documentId, chapterKey: "s0" })).ok).toBe(false);
    const third = await asA.action(api.concepts.prepare, { documentId, chapterKey: "s0" });
    expect(third).toMatchObject({ ok: false, message: expect.stringContaining("tomorrow") });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("map links: typed, cleaned, owner only, and one call per check", async () => {
    const { asA, asB, check, documentId } = await ready();
    const fetchMock = stubAI();
    expect(await asB.action(api.concepts.mapLinks, { checkId: check.checkId })).toEqual({ ok: false });
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await asA.action(api.concepts.mapLinks, { checkId: check.checkId });
    const after = (await asA.query(api.concepts.get, { documentId, chapterKey: "s0" }))!;
    expect(after.links).toEqual([{ from: "i1", to: "i2", type: "requires", note: "Balancing needs a pool." }]);
    expect(after.canMapLinks).toBe(false);
    await asA.action(api.concepts.mapLinks, { checkId: check.checkId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("deleting a book removes all concept data", async () => {
    const { t, asA, check, documentId } = await ready();
    const sessionId = await asA.mutation(api.concepts.start, { checkId: check.checkId, kind: "today" });
    await asA.mutation(api.concepts.answer, { sessionId, position: 0, option: 0, confidence: "sure" });
    await t.mutation(internal.documents.purge, { documentId });
    const left = await t.run(async (ctx) => [await ctx.db.query("conceptChecks").collect(), await ctx.db.query("conceptQuestions").collect(), await ctx.db.query("conceptSessions").collect(), await ctx.db.query("conceptAnswers").collect()]);
    expect(left.flat()).toEqual([]);
  });
});
