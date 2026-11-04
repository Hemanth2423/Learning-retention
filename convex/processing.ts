// Internal functions used by the AI job (not callable from the browser).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { subIdea } from "./lessonTypes";

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

const pillarInput = v.object({
  title: v.string(),
  summary: v.string(),
  subIdeas: v.array(subIdea),
  insights: v.array(v.object({ text: v.string(), quote: v.string() })),
  misconceptions: v.array(v.string()),
  searchQuery: v.string(),
});

// Saves step 1's concept model: one topic row per pillar (lessons still pending), and queues the
// first pillar's lesson so the learner can start right away. The rest are built when opened.
export const saveConceptModel = internalMutation({
  args: {
    courseId: v.id("courses"),
    pageCount: v.number(),
    thesis: v.string(),
    conceptLinks: v.array(v.object({ from: v.string(), to: v.string(), relation: v.string() })),
    pillars: v.array(pillarInput),
  },
  handler: async (ctx, { courseId, pageCount, thesis, conceptLinks, pillars }) => {
    const course = await ctx.db.get(courseId);
    if (!course) return; // deleted while processing
    const old = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const t of old) await ctx.db.delete(t._id);
    let firstId = null;
    for (const [order, p] of pillars.entries()) {
      const id = await ctx.db.insert("topics", {
        ...p,
        courseId,
        userId: course.userId,
        order,
        lessonStatus: order === 0 ? "generating" : "pending",
        examples: [],
        checks: [],
      });
      if (order === 0) firstId = id;
    }
    await ctx.db.patch(courseId, {
      pageCount,
      thesis,
      conceptLinks,
      status: "ready",
      statusMessage: undefined,
    });
    if (firstId) await ctx.scheduler.runAfter(0, internal.lessons.generate, { topicId: firstId });
  },
});

export const saveNextSteps = internalMutation({
  args: {
    courseId: v.id("courses"),
    nextSteps: v.array(
      v.object({ concept: v.string(), why: v.string(), resourceTitle: v.string(), resourceUrl: v.string() })
    ),
  },
  handler: async (ctx, { courseId, nextSteps }) => {
    if (await ctx.db.get(courseId)) await ctx.db.patch(courseId, { nextSteps });
  },
});

// Topics + best scores for one course, used to write the next-steps prompt.
export const progressForCourse = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return topics.map((t) => {
      const mine = attempts.filter((a) => a.topicId === t._id);
      const best = mine.length ? Math.max(...mine.map((a) => Math.round((a.score / a.total) * 100))) : null;
      return { title: t.title, summary: t.summary, best };
    });
  },
});
