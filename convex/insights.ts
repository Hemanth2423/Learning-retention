// The Dashboard (Part 7): reading stats per book and chapter, and testing stats per concept check.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { chapterRanges } from "./chapters";
import { MODES, Mode, nextCheckAt, standing } from "./conceptRules";
import { toAnswer, toBank } from "./concepts";
import { requireUser } from "./helpers";
import { activityByDay, readingByChapter } from "./insightRules";

export const overview = query({
  args: { tzOffsetMinutes: v.number() },
  handler: async (ctx, { tzOffsetMinutes }) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const docs = (await ctx.db.query("documents").withIndex("by_user", (q) => q.eq("userId", userId)).collect()).filter((d) => d.status === "ready");

    const books = await Promise.all(
      docs.map(async (d) => {
        const notes = await ctx.db.query("notes").withIndex("by_document", (q) => q.eq("documentId", d._id)).collect();
        const highlights = await ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", d._id)).collect();
        const chapters = readingByChapter(d, notes, highlights.map((h) => h.locator.page));
        return { id: d._id, title: d.title, sourceType: d.sourceType, lastReadAt: d.lastReadAt ?? null, chapters, notes: notes.length, highlights: highlights.length };
      })
    );

    const checks = await ctx.db.query("conceptChecks").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const allAnswers: { at: number; correct: boolean }[] = [];
    const tests = await Promise.all(
      checks.map(async (c) => {
        const doc = docs.find((d) => d._id === c.documentId);
        if (!doc || c.batchesDone === 0) return null;
        const bank = toBank(await ctx.db.query("conceptQuestions").withIndex("by_check_mode", (q) => q.eq("checkId", c._id)).collect());
        const active = new Set(bank.map((q) => q.id as string));
        const answers = (await ctx.db.query("conceptAnswers").withIndex("by_check_at", (q) => q.eq("checkId", c._id)).collect()).filter((a) => active.has(a.questionId));
        allAnswers.push(...answers);
        const cells = standing(c.ideas.map((i) => i.id), bank, answers.map(toAnswer), now);
        const solid = Object.fromEntries(MODES.map((m) => [m, cells.filter((x) => x.mode === m && x.status === "solid").length])) as Record<Mode, number>;
        const chapter = chapterRanges(doc.sections ?? [], doc.pageCount ?? 0).find((r) => r.key === c.chapterKey);
        const next = nextCheckAt(cells);
        return {
          documentId: c.documentId,
          chapterKey: c.chapterKey,
          bookTitle: doc.title,
          chapterTitle: chapter?.title ?? doc.title,
          ideas: c.ideas.length,
          solid,
          checked: new Set(cells.filter((x) => x.status !== "not_checked").map((x) => x.ideaId)).size,
          needsPractice: cells.filter((x) => x.status === "needs_practice").length,
          answered: answers.length,
          right: answers.filter((a) => a.correct).length,
          lastAt: answers.length ? answers[answers.length - 1].at : null,
          nextCheckAt: next,
          due: next !== null && next <= now,
        };
      })
    );

    const quickTests = (await Promise.all(docs.map((d) => ctx.db.query("quizAttempts").withIndex("by_document_chapter", (q) => q.eq("documentId", d._id)).collect()))).flat().filter((a) => a.finished && !a.review).length;

    return {
      books: books.sort((a, b) => (b.lastReadAt ?? 0) - (a.lastReadAt ?? 0)),
      tests: tests.filter((t) => t !== null).sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0)),
      activity: activityByDay(allAnswers, now, tzOffsetMinutes),
      quickTests,
    };
  },
});
