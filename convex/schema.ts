import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

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
    mindMap: v.optional(v.string()), // markdown outline rendered by markmap
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

  // Key topics extracted from a course. One course → many topics.
  topics: defineTable({
    courseId: v.id("courses"),
    userId: v.id("users"),
    order: v.number(),
    title: v.string(),
    summary: v.string(),
    keyPoints: v.array(v.string()),
    examples: v.array(
      v.object({ title: v.string(), description: v.string(), sourceUrl: v.string() })
    ),
    quiz: v.array(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
        answerIndex: v.number(),
        explanation: v.string(),
      })
    ),
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
