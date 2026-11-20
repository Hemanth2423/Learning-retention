import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const note = (text: string) => ({
  content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }),
  plainText: text,
});
const at = (key: string, title: string, page: number, level = 1) => ({ key, title, level, locator: { kind: "pdf" as const, page } });

async function setup() {
  const t = convexTest(schema, modules);
  const [userA, userB] = await t.run(async (ctx) => [
    await ctx.db.insert("users", { email: "a@test.com" }),
    await ctx.db.insert("users", { email: "b@test.com" }),
  ]);
  const [documentId, articleId] = await t.run(async (ctx) => {
    const fileId = await ctx.storage.store(new Blob(["%PDF-"]));
    const book = await ctx.db.insert("documents", {
      userId: userA,
      title: "Book",
      sourceType: "pdf",
      fileId,
      status: "ready",
      pageCount: 30,
      sections: [at("s0", "One", 1), at("s2", "Two", 10), at("s3", "Three", 20)],
    });
    const article = await ctx.db.insert("documents", {
      userId: userA,
      title: "Essay",
      sourceType: "article",
      status: "ready",
      pageCount: 4,
      hasText: true,
      sections: [{ key: "article", title: "Essay", level: 1, locator: { kind: "text", page: 1 } }],
    });
    return [book, article];
  });
  return { t, userA, asA: t.withIdentity({ subject: userA }), asB: t.withIdentity({ subject: userB }), documentId, articleId };
}

describe("notebook notes", () => {
  test("many notes per book: about a chapter, or none (General notes), in any order", async () => {
    const { asA, documentId } = await setup();
    await asA.mutation(api.notebook.saveNote, { documentId, sectionKey: "s3", ...note("Chapter three first") });
    await asA.mutation(api.notebook.saveNote, { documentId, ...note("A general thought") });
    await asA.mutation(api.notebook.saveNote, { documentId, sectionKey: "s3", ...note("A second note on three") });
    const { notes } = await asA.query(api.notebook.list, { documentId });
    expect(notes.map((n) => [n.sectionKey, n.plainText])).toEqual([
      ["s3", "Chapter three first"],
      [null, "A general thought"],
      ["s3", "A second note on three"],
    ]);
  });

  test("editing changes the note (and can move it to another chapter); emptying it deletes it", async () => {
    const { asA, documentId } = await setup();
    const { noteId } = await asA.mutation(api.notebook.saveNote, { documentId, sectionKey: "s0", ...note("draft") });
    await asA.mutation(api.notebook.saveNote, { documentId, noteId: noteId!, sectionKey: "s2", ...note("better") });
    expect((await asA.query(api.notebook.list, { documentId })).notes).toMatchObject([{ sectionKey: "s2", plainText: "better" }]);
    await asA.mutation(api.notebook.saveNote, { documentId, noteId: noteId!, sectionKey: "s2", content: "", plainText: " " });
    expect((await asA.query(api.notebook.list, { documentId })).notes).toEqual([]);
  });

  test("only real chapters, and sane video times, are accepted", async () => {
    const { asA, documentId } = await setup();
    await expect(asA.mutation(api.notebook.saveNote, { documentId, sectionKey: "nope", ...note("x") })).rejects.toThrow(/doesn't exist/);
    await expect(asA.mutation(api.notebook.saveNote, { documentId, seconds: -5, ...note("x") })).rejects.toThrow(/isn't in the video/);
  });

  test("a chapter's first note earns 20 XP once; general notes and articles earn none", async () => {
    const { asA, documentId, articleId } = await setup();
    expect((await asA.mutation(api.notebook.saveNote, { documentId, sectionKey: "s0", ...note("one") })).xp).toBe(20);
    expect((await asA.mutation(api.notebook.saveNote, { documentId, sectionKey: "s0", ...note("two") })).xp).toBe(0);
    expect((await asA.mutation(api.notebook.saveNote, { documentId, ...note("general") })).xp).toBe(0);
    expect((await asA.mutation(api.notebook.saveNote, { documentId: articleId, sectionKey: "article", ...note("essay") })).xp).toBe(0);
    expect((await asA.query(api.xp.stats, {})).xp).toBe(20);
  });

  test("another user can't read, change or delete them; logged-out visitors are rejected", async () => {
    const { t, asA, asB, documentId } = await setup();
    const { noteId } = await asA.mutation(api.notebook.saveNote, { documentId, ...note("mine") });
    expect(await asB.query(api.notebook.list, { documentId })).toEqual({ notes: [], saved: [] });
    await expect(asB.mutation(api.notebook.saveNote, { documentId, noteId: noteId!, ...note("theirs") })).rejects.toThrow();
    await asB.mutation(api.notebook.removeNote, { noteId: noteId! });
    expect((await asA.query(api.notebook.list, { documentId })).notes).toHaveLength(1);
    await expect(t.query(api.notebook.list, { documentId })).rejects.toThrow();
    await asA.mutation(api.notebook.removeNote, { noteId: noteId! });
    expect((await asA.query(api.notebook.list, { documentId })).notes).toHaveLength(0);
  });
});

describe("saved questions", () => {
  async function wrongAnswer() {
    const s = await setup();
    const { quizId, attemptId } = await s.t.run(async (ctx) => {
      const quizId = await ctx.db.insert("quizzes", {
        userId: s.userA,
        documentId: s.documentId,
        chapterKey: "s0",
        questions: [{ question: "What starts a habit?", options: ["A reward", "A cue", "A routine", "Sleep"], answer: 1, explanation: "", whyWrong: ["", "", "", ""], page: 4 }],
      });
      const attemptId = await ctx.db.insert("quizAttempts", {
        userId: s.userA,
        documentId: s.documentId,
        chapterKey: "s0",
        quizId,
        review: false,
        results: [{ index: 0, choice: null, correct: null }],
        score: 0,
        finished: false,
      });
      return { quizId, attemptId };
    });
    await s.asA.mutation(api.quizzes.answer, { attemptId, position: 0, choice: 0 });
    return { ...s, quizId, attemptId };
  }

  test("keeps the question, my answer and the right one under that chapter, once", async () => {
    const { asA, documentId, attemptId } = await wrongAnswer();
    await asA.mutation(api.notebook.saveQuestion, { attemptId, position: 0 });
    await asA.mutation(api.notebook.saveQuestion, { attemptId, position: 0 });
    expect((await asA.query(api.notebook.list, { documentId })).saved).toMatchObject([
      { chapterKey: "s0", question: "What starts a habit?", yourAnswer: "A reward", rightAnswer: "A cue", page: 4 },
    ]);
  });

  test("results never go in by themselves, and only the test's owner can save", async () => {
    const { asA, asB, documentId, attemptId } = await wrongAnswer();
    expect((await asA.query(api.notebook.list, { documentId })).saved).toEqual([]);
    await expect(asB.mutation(api.notebook.saveQuestion, { attemptId, position: 0 })).rejects.toThrow();
    await expect(asA.mutation(api.notebook.saveQuestion, { attemptId, position: 3 })).rejects.toThrow();
  });
});

describe("text highlights", () => {
  test("an article can be highlighted by block and offset; the locator is the start block", async () => {
    const { t, asA, articleId } = await setup();
    const id = await asA.mutation(api.notebook.addTextHighlight, {
      documentId: articleId,
      text: "  the  frontier ",
      range: { startBlock: 2, startOffset: 4, endBlock: 2, endOffset: 16 },
    });
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ text: "the frontier", locator: { kind: "text", page: 2 }, segments: [] });
  });

  test("ranges outside the text, backwards ranges, PDFs and other users are refused", async () => {
    const { asA, asB, documentId, articleId } = await setup();
    const add = (as: typeof asA, d: Id<"documents">, range: { startBlock: number; startOffset: number; endBlock: number; endOffset: number }) =>
      as.mutation(api.notebook.addTextHighlight, { documentId: d, text: "words", range });
    await expect(add(asA, articleId, { startBlock: 5, startOffset: 0, endBlock: 5, endOffset: 3 })).rejects.toThrow(/isn't in this text/);
    await expect(add(asA, articleId, { startBlock: 2, startOffset: 9, endBlock: 2, endOffset: 3 })).rejects.toThrow(/isn't in this text/);
    await expect(add(asA, documentId, { startBlock: 1, startOffset: 0, endBlock: 1, endOffset: 3 })).rejects.toThrow();
    await expect(add(asB, articleId, { startBlock: 1, startOffset: 0, endBlock: 1, endOffset: 3 })).rejects.toThrow();
  });
});

describe("moving old chapter notes into the Notebook", () => {
  test("each old note becomes a note on its chapter; nothing is lost and it can run twice", async () => {
    const { t, userA, asA, documentId } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("reflections", { userId: userA, documentId, sectionKey: "s2", ...note("old note") });
      await ctx.db.insert("reflections", { userId: userA, documentId, sectionKey: "s3", dismissed: true });
    });
    expect(await t.mutation(internal.notebook.migrateReflections, {})).toBe(1);
    expect(await t.mutation(internal.notebook.migrateReflections, {})).toBe(0);
    expect((await asA.query(api.notebook.list, { documentId })).notes).toMatchObject([{ sectionKey: "s2", plainText: "old note" }]);
    expect(await t.run((ctx) => ctx.db.query("reflections").collect())).toHaveLength(2); // rows stay
  });
});
