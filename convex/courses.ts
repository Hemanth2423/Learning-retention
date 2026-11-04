import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwnCourse, requireUser } from "./helpers";

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
    return await ctx.db.insert("courses", {
      userId,
      title: args.title.trim(),
      subject: args.subject.trim(),
      notes: args.notes?.trim() || undefined,
      fileId: args.fileId,
      status: "processing",
    });
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
    return courseId ? await getOwnCourse(ctx, userId, courseId) : null;
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
      await ctx.db.delete(topic._id);
    }
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    for (const a of attempts) await ctx.db.delete(a._id);
    await ctx.storage.delete(course.fileId);
    await ctx.db.delete(courseId);
  },
});
