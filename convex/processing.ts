// Internal functions used by the AI job (not callable from the browser).
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getCourse = internalQuery({
  args: { courseId: v.id("courses") },
  handler: (ctx, { courseId }) => ctx.db.get(courseId),
});

export const setStatus = internalMutation({
  args: {
    courseId: v.id("courses"),
    status: v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, status, statusMessage }) => {
    if (await ctx.db.get(courseId)) await ctx.db.patch(courseId, { status, statusMessage });
  },
});

const topicInput = v.object({
  title: v.string(),
  summary: v.string(),
  keyPoints: v.array(v.string()),
  examples: v.array(v.object({ title: v.string(), description: v.string(), sourceUrl: v.string() })),
  quiz: v.array(
    v.object({
      question: v.string(),
      options: v.array(v.string()),
      answerIndex: v.number(),
      explanation: v.string(),
    })
  ),
});

export const saveResults = internalMutation({
  args: {
    courseId: v.id("courses"),
    pageCount: v.number(),
    mindMap: v.string(),
    topics: v.array(topicInput),
  },
  handler: async (ctx, { courseId, pageCount, mindMap, topics }) => {
    const course = await ctx.db.get(courseId);
    if (!course) return; // deleted while processing
    const old = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const t of old) await ctx.db.delete(t._id);
    for (const [order, t] of topics.entries()) {
      await ctx.db.insert("topics", { ...t, courseId, userId: course.userId, order });
    }
    await ctx.db.patch(courseId, { pageCount, mindMap, status: "ready", statusMessage: undefined });
  },
});
