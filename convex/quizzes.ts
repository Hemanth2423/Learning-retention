import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";
import { bestPct } from "./progress";

// Grades on the server against the stored answers, so the score can't be faked from the browser.
export const submit = mutation({
  args: { topicId: v.id("topics"), answers: v.array(v.number()) },
  handler: async (ctx, { topicId, answers }) => {
    const userId = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.userId !== userId) throw new ConvexError("Topic not found.");
    if (answers.length !== topic.quiz.length || answers.some((a) => a < 0)) {
      throw new ConvexError("Answer every question before submitting.");
    }
    const results = topic.quiz.map((q, i) => ({
      correct: answers[i] === q.answerIndex,
      answerIndex: q.answerIndex,
      explanation: q.explanation,
    }));
    const score = results.filter((r) => r.correct).length;
    await ctx.db.insert("quizAttempts", {
      userId,
      topicId,
      courseId: topic.courseId,
      score,
      total: topic.quiz.length,
    });
    return { score, total: topic.quiz.length, results };
  },
});

export const historyForTopic = query({
  args: { topicId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const topicId = ctx.db.normalizeId("topics", args.topicId);
    if (!topicId) return { attempts: [], best: null };
    const attempts = (
      await ctx.db
        .query("quizAttempts")
        .withIndex("by_topic", (q) => q.eq("topicId", topicId))
        .order("desc")
        .collect()
    ).filter((a) => a.userId === userId);
    return { attempts, best: bestPct(attempts) };
  },
});
