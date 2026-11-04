import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { check, lesson, subIdea } from "./lessonTypes";

export default defineSchema({
  // users (+ sessions/accounts) come from Convex Auth.
  ...authTables,

  // One uploaded PDF (a chapter or slide deck). One user → many courses.
  courses: defineTable({
    userId: v.id("users"),
    title: v.string(),
    subject: v.string(),
    notes: v.optional(v.string()),
    fileId: v.id("_storage"),
    pageCount: v.optional(v.number()),
    status: v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    statusMessage: v.optional(v.string()),
    mindMap: v.optional(v.string()), // legacy: old markdown outline; the concept map is now built from topics
    thesis: v.optional(v.string()), // the one big idea of the whole document
    conceptLinks: v.optional(v.array(v.object({ from: v.string(), to: v.string(), relation: v.string() }))),
    nextSteps: v.optional(
      v.array(
        v.object({
          concept: v.string(),
          why: v.string(),
          resourceTitle: v.string(),
          resourceUrl: v.string(),
        })
      )
    ),
  }).index("by_user", ["userId"]),

  // A "pillar": one core idea of the course from the concept model. One course → many topics.
  // The concept fields are filled at upload; the lesson is built on demand when it's opened.
  topics: defineTable({
    courseId: v.id("courses"),
    userId: v.id("users"),
    order: v.number(), // the learning order (prerequisites first)
    title: v.string(),
    summary: v.string(),
    subIdeas: v.array(subIdea),
    insights: v.array(v.object({ text: v.string(), quote: v.string() })),
    misconceptions: v.array(v.string()),
    searchQuery: v.string(),
    lessonStatus: v.union(v.literal("pending"), v.literal("generating"), v.literal("ready"), v.literal("failed")),
    lessonError: v.optional(v.string()),
    lesson: v.optional(lesson),
    examples: v.array(v.object({ title: v.string(), description: v.string(), sourceUrl: v.string() })),
    checks: v.array(check),
  })
    .index("by_course", ["courseId", "order"])
    .index("by_user", ["userId"]),

  // Every quiz a user takes on a topic. One topic → many attempts.
  quizAttempts: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
    courseId: v.id("courses"),
    score: v.number(),
    total: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_course", ["courseId"]),

  // Junction table: "this user starred this topic". Many users ↔ many topics.
  stars: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
  })
    .index("by_user", ["userId"])
    .index("by_user_topic", ["userId", "topicId"])
    .index("by_topic", ["topicId"]),
});
