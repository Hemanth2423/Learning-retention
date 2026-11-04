import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./helpers";

// Stars or un-stars a topic. One row in `stars` = "this user starred this topic".
export const toggle = mutation({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const userId = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.userId !== userId) throw new ConvexError("Topic not found.");
    const existing = await ctx.db
      .query("stars")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("stars", { userId, topicId });
    return true;
  },
});

export const isStarred = query({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const userId = await requireUser(ctx);
    const star = await ctx.db
      .query("stars")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
      .unique();
    return star !== null;
  },
});

// The "Starred" view: my starred topics, most recently starred first.
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const stars = await ctx.db
      .query("stars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const rows = await Promise.all(
      stars.map(async (s) => {
        const topic = await ctx.db.get(s.topicId);
        if (!topic) return null;
        const course = await ctx.db.get(topic.courseId);
        return {
          starId: s._id,
          starredAt: s._creationTime,
          topicId: topic._id,
          title: topic.title,
          summary: topic.summary,
          courseTitle: course?.title ?? "",
        };
      })
    );
    return rows.filter((r) => r !== null);
  },
});
