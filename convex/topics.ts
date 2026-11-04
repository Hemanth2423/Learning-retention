import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";

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
    return topics.filter((t) => t.userId === userId);
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
    return { ...topic, courseTitle: course?.title ?? "" };
  },
});
