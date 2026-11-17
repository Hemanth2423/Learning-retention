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
    const pages = [
      "The habit loop has three parts: a cue, a routine and a reward.",
      "A craving is the motivation behind every habit.",
      "Sleep matters for memory because the brain replays what it learned.",
      "Spaced repetition means reviewing facts at growing intervals.",
      "Active recall beats rereading for long term retention.",
      "Interleaving mixes topics so learners practice choosing a method.",
    ];
    for (let i = 0; i < pages.length; i++) await ctx.db.insert("chunks", { documentId: id, userId: userA, index: i, text: pages[i], locator: { kind: "pdf", page: i + 1 } });
    return id;
  });
  return { t, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId, userA };
}

// Pretends to be the AI service.
function mockAi(reply: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }], usage: {} }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.GROQ_API_KEY = "test";
  delete process.env.LLM_PROVIDER;
});
afterEach(() => vi.unstubAllGlobals());

describe("chat", () => {
  test("a question gets a cited answer, saved in the book's history", async () => {
    const { asA, documentId } = await setup();
    mockAi({ answer: "It has a cue, routine and reward [1].", citations: [1, 9] });
    const res = await asA.action(api.chat.ask, { documentId, question: "What are the parts of the habit loop?", currentPage: 1, mode: "chat" });
    expect(res).toEqual({ ok: true });
    const history = await asA.query(api.chat.history, { documentId });
    expect(history.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(history[1].text).toContain("cue, routine and reward");
    expect(history[1].citations.length).toBeGreaterThan(0);
    expect(history[1].citations.every((c) => c.page >= 1 && c.page <= 6)).toBe(true); // never a made-up page
  });

  test("only 5 questions a day, and a failed one doesn't count", async () => {
    const { asA, documentId } = await setup();
    mockAi({ answer: "Fine [1].", citations: [1] });
    for (let i = 0; i < 5; i++) {
      expect(await asA.action(api.chat.ask, { documentId, question: `habit question ${i}`, currentPage: 1, mode: "chat" })).toEqual({ ok: true });
    }
    expect((await asA.query(api.chat.quota, {})).left).toBe(0);
    const blocked = await asA.action(api.chat.ask, { documentId, question: "habit again", currentPage: 1, mode: "chat" });
    expect(blocked).toMatchObject({ ok: false, resetAt: expect.any(Number) });

    const fresh = await setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const failed = await fresh.asA.action(api.chat.ask, { documentId: fresh.documentId, question: "habit loop", currentPage: 1, mode: "chat" });
    expect(failed).toMatchObject({ ok: false });
    expect((await fresh.asA.query(api.chat.quota, {})).left).toBe(5);
  });

  test("Summarize uses the chapter you're in and counts as a question", async () => {
    const { asA, documentId } = await setup();
    const fetchMock = mockAi({ answer: "- Spaced repetition [1]\n- Active recall [2]", citations: [1, 2] });
    await asA.action(api.chat.ask, { documentId, question: "", currentPage: 5, mode: "summarize" });
    const sent = JSON.stringify(fetchMock.mock.calls[0]);
    expect(sent).toContain("Spaced repetition");
    expect(sent).toContain("Interleaving");
    expect(sent).not.toContain("habit loop has three parts"); // chapter one is not in chapter two's summary
    expect((await asA.query(api.chat.quota, {})).left).toBe(4);
  });

  test("scanned books, other people's books and logged-out visitors are refused", async () => {
    const scanned = await setup(false);
    expect(await scanned.asA.action(api.chat.ask, { documentId: scanned.documentId, question: "hi there", currentPage: 1, mode: "chat" })).toMatchObject({ ok: false });
    const { asB, documentId, t } = await setup();
    expect(await asB.action(api.chat.ask, { documentId, question: "habit loop", currentPage: 1, mode: "chat" })).toMatchObject({ ok: false });
    expect(await asB.query(api.chat.history, { documentId })).toEqual([]);
    expect(await t.action(api.chat.ask, { documentId, question: "habit loop", currentPage: 1, mode: "chat" })).toMatchObject({ ok: false });
  });

  test("an unusable AI answer is an error, not a made-up reply", async () => {
    const { asA, documentId } = await setup();
    mockAi({ nonsense: true });
    expect(await asA.action(api.chat.ask, { documentId, question: "habit loop", currentPage: 1, mode: "chat" })).toMatchObject({ ok: false });
    expect(await asA.query(api.chat.history, { documentId })).toEqual([]);
  });
});

describe("validate a note", () => {
  test("returns checks with corrections, counts as a question, and isn't shown in the chat", async () => {
    const { asA, documentId } = await setup();
    mockAi({
      summary: "Close.",
      checks: [
        { claim: "The habit loop has three parts", status: "supported", citations: [1] },
        { claim: "Sleep hurts memory", status: "incorrect", correction: "Sleep helps memory [2].", citations: [2] },
      ],
    });
    const res = await asA.action(api.chat.validateNote, { documentId, chapterKey: "s0", noteText: "The habit loop has three parts. Sleep hurts memory." });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.verdict).toBe("has_issues");
      expect(res.result.checks[1].status).toBe("incorrect");
    }
    expect((await asA.query(api.chat.quota, {})).left).toBe(4);
    expect(await asA.query(api.chat.history, { documentId })).toEqual([]);
  });

  test("an empty note is refused without using a question", async () => {
    const { asA, documentId } = await setup();
    const res = await asA.action(api.chat.validateNote, { documentId, chapterKey: "s0", noteText: "   " });
    expect(res.ok).toBe(false);
    expect((await asA.query(api.chat.quota, {})).left).toBe(5);
  });
});
