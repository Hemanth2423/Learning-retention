import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";
import { computeStats } from "./progress";

export const stats = query({
  args: { tzOffsetMinutes: v.optional(v.number()) },
  handler: async (ctx, { tzOffsetMinutes }) => {
    const userId = await requireUser(ctx);
    const [courses, topics, answers] = await Promise.all([
      ctx.db.query("courses").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("topics").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("answers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    return computeStats(
      courses.length,
      topics.map((t) => t._id),
      answers,
      Date.now(),
      tzOffsetMinutes ?? 0
    );
  },
});
