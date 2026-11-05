import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getOwnCourse, requireUser } from "./helpers";
import { CourseFields, validateCourse } from "./validation";

function assertValid(fields: CourseFields) {
  const errors = validateCourse(fields);
  const first = Object.values(errors)[0];
  if (first) throw new ConvexError(first);
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    subject: v.string(),
    notes: v.optional(v.string()),
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    assertValid(args);
    const courseId = await ctx.db.insert("courses", {
      userId,
      title: args.title.trim(),
      subject: args.subject.trim(),
      notes: args.notes?.trim() || undefined,
      fileId: args.fileId,
      status: "processing",
      statusMessage: "Queued…",
    });
    await ctx.scheduler.runAfter(0, internal.ai.processCourse, { courseId });
    return courseId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// One course, or null if it doesn't exist or isn't yours.
export const get = query({
  args: { courseId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const courseId = ctx.db.normalizeId("courses", args.courseId); // bad URLs → null, not a crash
    const course = courseId ? await getOwnCourse(ctx, userId, courseId) : null;
    if (!course) return null;
    // Hide the connect questions' answers until they're answered.
    const capstone = course.capstone && {
      ...course.capstone,
      checks: course.capstone.checks.map(({ id, level, question, options }) => ({ id, level, question, options })),
    };
    return { ...course, capstone };
  },
});

export const update = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    subject: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { courseId, ...fields }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    if (!course) throw new Error("Course not found.");
    assertValid(fields);
    await ctx.db.patch(courseId, {
      title: fields.title.trim(),
      subject: fields.subject.trim(),
      notes: fields.notes?.trim() || undefined,
    });
  },
});

// Deletes the course plus everything that hangs off it.
export const remove = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    if (!course) throw new Error("Course not found.");
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const topic of topics) {
      const stars = await ctx.db
        .query("stars")
        .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
        .collect();
      for (const s of stars) await ctx.db.delete(s._id);
      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
        .collect();
      for (const r of reviews) await ctx.db.delete(r._id);
      await ctx.db.delete(topic._id);
    }
    const answers = await ctx.db
      .query("answers")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const a of answers) await ctx.db.delete(a._id);
    // Earned achievements stay (like Codecademy's): they're a record of what you did.
    await ctx.storage.delete(course.fileId);
    await ctx.db.delete(courseId);
  },
});

// Re-runs the AI breakdown (e.g. after a failure).
export const reprocess = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    if (!course) throw new Error("Course not found.");
    await ctx.db.patch(courseId, { status: "processing", statusMessage: "Queued…" });
    await ctx.scheduler.runAfter(0, internal.ai.processCourse, { courseId });
  },
});
