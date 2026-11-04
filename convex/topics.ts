import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";
import { bestPct } from "./progress";

export const listByCourse = query({
  args: { courseId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const courseId = ctx.db.normalizeId("courses", args.courseId);
    if (!courseId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return topics
      .filter((t) => t.userId === userId)
      .map(({ quiz, ...t }) => ({
        ...t,
        questionCount: quiz.length,
        best: bestPct(attempts.filter((a) => a.topicId === t._id && a.userId === userId)),
      }));
  },
});

// One topic with its course title, or null if it isn't yours.
export const get = query({
  args: { topicId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const topicId = ctx.db.normalizeId("topics", args.topicId);
    const topic = topicId ? await ctx.db.get(topicId) : null;
    if (!topic || topic.userId !== userId) return null;
    const course = await ctx.db.get(topic.courseId);
    // Hide the answers until the quiz is submitted.
    const quiz = topic.quiz.map(({ question, options }) => ({ question, options }));
    return { ...topic, quiz, courseTitle: course?.title ?? "" };
  },
});
