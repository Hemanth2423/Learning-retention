import { query } from "./_generated/server";
import { requireUser } from "./helpers";
import { computeStats } from "./progress";

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const [courses, topics, attempts] = await Promise.all([
      ctx.db.query("courses").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("topics").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("quizAttempts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    return computeStats(
      courses.length,
      topics.map((t) => t._id),
      attempts,
      Date.now()
    );
  },
});
