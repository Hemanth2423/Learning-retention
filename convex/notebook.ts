import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { chapterRanges } from "./chapters";
import { getOwnDocument, requireUser } from "./helpers";
import { MAX_HIGHLIGHTS_PER_DOCUMENT, normalizeText, validateComment, validateTextHighlight } from "./highlightRules";
import { MAX_NOTES_PER_DOCUMENT, MAX_SAVED_PER_DOCUMENT, validateSeconds } from "./notebookRules";
import { isEmptyNote, validateNote } from "./reflectionRules";
import { awardXp } from "./xp";
import { awardKey, XP } from "./xpRules";
import { Doc } from "./_generated/dataModel";

// Books earn XP for notes; articles, videos and documents don't (Feature 3 spec).
export const earnsXp = (doc: Doc<"documents">) => doc.sourceType === "pdf";

// Everything in a book's Notebook except highlights (the reader already loads those to draw them).
export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    if (!(await getOwnDocument(ctx, userId, documentId))) return { notes: [], saved: [] };
    const [notes, saved] = await Promise.all([
      ctx.db.query("notes").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_NOTES_PER_DOCUMENT),
      ctx.db.query("savedQuestions").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_SAVED_PER_DOCUMENT),
    ]);
    return {
      notes: notes.map((n) => ({ _id: n._id, _creationTime: n._creationTime, sectionKey: n.sectionKey ?? null, content: n.content, plainText: n.plainText, seconds: n.seconds ?? null, updatedAt: n.updatedAt })),
      saved: saved.map((s) => ({ _id: s._id, _creationTime: s._creationTime, chapterKey: s.chapterKey, question: s.question, yourAnswer: s.yourAnswer, rightAnswer: s.rightAnswer, page: s.page })),
    };
  },
});

// Write a new note (no noteId) or change one. A note can be about one chapter or none (General notes).
// Saving an existing note with nothing in it deletes it.
export const saveNote = mutation({
  args: {
    documentId: v.id("documents"),
    noteId: v.optional(v.id("notes")),
    sectionKey: v.optional(v.string()),
    content: v.string(),
    plainText: v.string(),
    seconds: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, noteId, sectionKey, content, plainText, seconds }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "ready") throw new ConvexError("We couldn't find that book.");
    if (sectionKey !== undefined && !chapterRanges(doc.sections ?? [], doc.pageCount ?? 0).some((c) => c.key === sectionKey))
      throw new ConvexError("That chapter doesn't exist.");
    const timeProblem = validateSeconds(seconds);
    if (timeProblem) throw new ConvexError(timeProblem);
    const existing = noteId ? await ctx.db.get(noteId) : null;
    if (noteId && (!existing || existing.userId !== userId || existing.documentId !== documentId)) throw new ConvexError("We couldn't find that note.");

    if (isEmptyNote(plainText, content)) {
      if (existing) await ctx.db.delete(existing._id);
      return { noteId: null, xp: 0 };
    }
    const problem = validateNote({ content, plainText });
    if (problem) throw new ConvexError(problem);
    const fields = { sectionKey, content, plainText, seconds: seconds ?? existing?.seconds, updatedAt: Date.now() };
    let id = existing?._id ?? null;
    if (existing) await ctx.db.patch(existing._id, fields);
    else {
      const count = (await ctx.db.query("notes").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_NOTES_PER_DOCUMENT)).length;
      if (count >= MAX_NOTES_PER_DOCUMENT) throw new ConvexError("This book has reached the note limit.");
      id = await ctx.db.insert("notes", { userId, documentId, ...fields });
    }
    // 20 XP for a chapter's first note (paid once per chapter, however many notes it gets). Books only.
    const xp = sectionKey !== undefined && earnsXp(doc) ? await awardXp(ctx, userId, [{ key: awardKey.note(documentId, sectionKey), xp: XP.note }]) : 0;
    return { noteId: id, xp };
  },
});

export const removeNote = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, { noteId }) => {
    const userId = await requireUser(ctx);
    const note = await ctx.db.get(noteId);
    if (note && note.userId === userId) await ctx.db.delete(noteId);
  },
});

// "📓 Save to notes" after a wrong answer: the question, the reader's answer and the right one, from the server's copy
// of the test (answers never come from the browser). Saving the same question twice keeps one copy.
export const saveQuestion = mutation({
  args: { attemptId: v.id("quizAttempts"), position: v.number() },
  handler: async (ctx, { attemptId, position }) => {
    const userId = await requireUser(ctx);
    const attempt = await ctx.db.get(attemptId);
    if (!attempt || attempt.userId !== userId) throw new ConvexError("We couldn't find that test.");
    const slot = attempt.results[position];
    const quiz = await ctx.db.get(attempt.quizId);
    if (!slot || !quiz || slot.choice === null) throw new ConvexError("Answer the question first.");
    const q = quiz.questions[slot.index];
    const row = {
      userId,
      documentId: attempt.documentId,
      chapterKey: attempt.chapterKey,
      question: q.question,
      yourAnswer: q.options[slot.choice] ?? "",
      rightAnswer: q.options[q.answer] ?? "",
      page: q.page,
    };
    const saved = await ctx.db.query("savedQuestions").withIndex("by_document", (x) => x.eq("documentId", attempt.documentId)).take(MAX_SAVED_PER_DOCUMENT);
    const same = saved.find((s) => s.question === q.question && s.chapterKey === attempt.chapterKey);
    if (same) {
      await ctx.db.patch(same._id, { yourAnswer: row.yourAnswer });
      return same._id;
    }
    if (saved.length >= MAX_SAVED_PER_DOCUMENT) throw new ConvexError("This book has reached the saved-question limit.");
    return await ctx.db.insert("savedQuestions", row);
  },
});

export const removeQuestion = mutation({
  args: { savedId: v.id("savedQuestions") },
  handler: async (ctx, { savedId }) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(savedId);
    if (row && row.userId === userId) await ctx.db.delete(savedId);
  },
});

// A highlight in a text source (article, and later EPUB / Word). PDFs use highlights.add with page boxes.
export const addTextHighlight = mutation({
  args: {
    documentId: v.id("documents"),
    text: v.string(),
    range: v.object({ startBlock: v.number(), startOffset: v.number(), endBlock: v.number(), endOffset: v.number() }),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, text, range, comment }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "ready" || doc.sourceType === "pdf" || doc.sourceType === "video") throw new ConvexError("We couldn't find that text.");
    if (doc.hasText === false) throw new ConvexError("This page was saved as a link, so it can't be highlighted here.");
    const problem = validateTextHighlight({ text, range, blockCount: doc.pageCount ?? 0 }) ?? (comment ? validateComment(comment) : undefined);
    if (problem) throw new ConvexError(problem);
    const existing = await ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_HIGHLIGHTS_PER_DOCUMENT);
    if (existing.length >= MAX_HIGHLIGHTS_PER_DOCUMENT) throw new ConvexError("This has reached the highlight limit.");
    return await ctx.db.insert("highlights", {
      userId,
      documentId,
      locator: { kind: "text", page: range.startBlock },
      text: normalizeText(text),
      segments: [],
      range,
      comment: comment?.trim() || undefined,
    });
  },
});

// One-off move of the old one-note-per-chapter `reflections` into `notes` (each becomes a note on its chapter).
// Run with `npx convex run notebook:migrateReflections` until it returns 0. Safe to run again: moved rows keep no text.
export const migrateReflections = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = (await ctx.db.query("reflections").take(4000)).filter((r) => r.content !== undefined).slice(0, 200);
    for (const r of rows) {
      await ctx.db.insert("notes", {
        userId: r.userId,
        documentId: r.documentId,
        sectionKey: r.sectionKey,
        content: r.content!,
        plainText: r.plainText ?? "",
        updatedAt: r._creationTime,
      });
      await ctx.db.patch(r._id, { content: undefined, plainText: undefined });
    }
    return rows.length;
  },
});
