import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./helpers";
import { pillarProgress } from "./progress";
import { bankOf, publicQuestion } from "./questionRules";

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
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return topics
      .filter((t) => t.userId === userId)
      .map(({ checks: _checks, questions: _questions, predict: _predict, lesson: _lesson, insights: _insights, ...t }) => ({
        ...t,
        progress: pillarProgress(answers.filter((a) => a.topicId === t._id && a.userId === userId)),
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
    // Hide answers and explanations: they're only revealed after the learner answers.
    const questions = bankOf(topic).map(publicQuestion);
    const { checks: _checks, questions: _questions, predict, ...rest } = topic;
    const path = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", topic.courseId))
      .collect();
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_course", (q) => q.eq("courseId", topic.courseId))
      .collect();
    const progressOf = (id: string) => pillarProgress(answers.filter((a) => a.topicId === id && a.userId === userId));
    return {
      ...rest,
      questions,
      predict: predict ? publicQuestion(predict) : null,
      courseTitle: course?.title ?? "",
      // The whole course path, for the "where am I / what's next" progression.
      path: path.map((p) => ({
        _id: p._id,
        order: p.order,
        title: p.title,
        lessonStatus: p.lessonStatus,
        mastered: progressOf(p._id).state === "mastered",
      })),
      progress: progressOf(topic._id),
    };
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
    const [topics, courses, answers, stars] = await Promise.all([
      ctx.db.query("topics").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("courses").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("answers").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("stars").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);
    const courseTitle = new Map(courses.map((c) => [c._id as string, c.title]));
    const starred = new Set(stars.map((s) => s.topicId as string));
    const needle = args.text.trim().toLowerCase();

    let rows = topics.map(({ checks: _checks, questions: _questions, predict: _predict, examples: _examples, lesson: _lesson, ...t }) => ({
      ...t,
      courseTitle: courseTitle.get(t.courseId) ?? "",
      progress: pillarProgress(answers.filter((a) => a.topicId === t._id)),
      starred: starred.has(t._id),
    }));

    if (needle) {
      rows = rows.filter((t) =>
        [t.title, t.summary, t.courseTitle, ...t.subIdeas.map((s) => s.title), ...t.insights.map((i) => i.text)].some(
          (s) => s.toLowerCase().includes(needle)
        )
      );
    }
    if (args.courseId) rows = rows.filter((t) => t.courseId === args.courseId);
    if (args.mastery === "mastered") rows = rows.filter((t) => t.progress.state === "mastered");
    if (args.mastery === "notMastered") rows = rows.filter((t) => t.progress.state === "learning");
    if (args.mastery === "untested") rows = rows.filter((t) => t.progress.state === "untested");

    const score = (t: { progress: { score: number | null } }) => t.progress.score ?? -1;
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
