import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";
import { bestPct, isMastered } from "./progress";

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

// Search + filter + sort across all of my topics.
export const find = query({
  args: {
    text: v.string(),
    courseId: v.optional(v.string()),
    mastery: v.union(v.literal("all"), v.literal("mastered"), v.literal("notMastered"), v.literal("untested")),
    sort: v.union(v.literal("newest"), v.literal("oldest"), v.literal("scoreHigh"), v.literal("scoreLow"), v.literal("az")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const [topics, courses, attempts, stars] = await Promise.all([
      ctx.db.query("topics").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("courses").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("quizAttempts").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("stars").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    const courseTitle = new Map(courses.map((c) => [c._id as string, c.title]));
    const starred = new Set(stars.map((s) => s.topicId as string));
    const needle = args.text.trim().toLowerCase();

    let rows = topics.map(({ quiz: _quiz, examples: _examples, ...t }) => ({
      ...t,
      courseTitle: courseTitle.get(t.courseId) ?? "",
      best: bestPct(attempts.filter((a) => a.topicId === t._id)),
      starred: starred.has(t._id),
    }));

    if (needle) {
      rows = rows.filter((t) =>
        [t.title, t.summary, t.courseTitle, ...t.keyPoints].some((s) => s.toLowerCase().includes(needle))
      );
    }
    if (args.courseId) rows = rows.filter((t) => t.courseId === args.courseId);
    if (args.mastery === "mastered") rows = rows.filter((t) => isMastered(t.best));
    if (args.mastery === "notMastered") rows = rows.filter((t) => t.best !== null && !isMastered(t.best));
    if (args.mastery === "untested") rows = rows.filter((t) => t.best === null);

    const score = (t: { best: number | null }) => t.best ?? -1;
    const sorters = {
      newest: (a: (typeof rows)[number], b: (typeof rows)[number]) => b._creationTime - a._creationTime || a.order - b.order,
      oldest: (a: (typeof rows)[number], b: (typeof rows)[number]) => a._creationTime - b._creationTime || a.order - b.order,
      scoreHigh: (a: (typeof rows)[number], b: (typeof rows)[number]) => score(b) - score(a),
      scoreLow: (a: (typeof rows)[number], b: (typeof rows)[number]) => score(a) - score(b),
      az: (a: (typeof rows)[number], b: (typeof rows)[number]) => a.title.localeCompare(b.title),
    };
    rows.sort(sorters[args.sort]);
    return { rows, courses: courses.map((c) => ({ _id: c._id, title: c.title })) };
  },
});
