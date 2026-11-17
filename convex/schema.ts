import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { check, lesson, question, subIdea } from "./lessonTypes";
import { locator } from "./locators";

// One stored test question (see quizRules.ts). Exported so the save step checks the same shape.
export const quizQuestion = v.object({
  question: v.string(),
  options: v.array(v.string()),
  answer: v.number(),
  explanation: v.string(),
  whyWrong: v.array(v.string()),
  page: v.optional(v.number()),
});

export default defineSchema({
  // users (+ sessions/accounts) come from Convex Auth.
  ...authTables,

  // ---- Reading experience (Feature 1). See ARCHITECTURE.md and decisions/004. ----

  // One thing the user is learning from. `sourceType` is "pdf" today; links/video come later.
  documents: defineTable({
    userId: v.id("users"),
    title: v.string(),
    sourceType: v.literal("pdf"),
    fileId: v.id("_storage"),
    status: v.union(v.literal("processing"), v.literal("ready"), v.literal("failed")),
    statusMessage: v.optional(v.string()),
    hasText: v.optional(v.boolean()), // false = scanned/image-only: reading works, highlights and chat are off
    pageCount: v.optional(v.number()),
    sections: v.optional(v.array(v.object({ key: v.string(), title: v.string(), level: v.number(), locator }))), // contents
    lastLocator: v.optional(locator), // where the reader left off
    lastReadAt: v.optional(v.number()), // when the reader last moved in this book (orders the library)
    pagesSeen: v.optional(v.string()), // one character per page: "1" once it was on screen for ~2 s (see readingRules.ts)
  }).index("by_user", ["userId"]),

  // A highlight, with an optional comment. `locator` is its first page (where the left panel jumps).
  // `segments` are the PDF boxes it covers, one entry per page, as fractions of the page size.
  highlights: defineTable({
    userId: v.id("users"),
    documentId: v.id("documents"),
    locator,
    text: v.string(),
    segments: v.array(
      v.object({ page: v.number(), rects: v.array(v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() })) })
    ),
    comment: v.optional(v.string()),
  }).index("by_document", ["documentId"]),

  // An image added to a note. Tracked so it's deleted with the book (the note itself only holds its link).
  noteImages: defineTable({
    userId: v.id("users"),
    documentId: v.id("documents"),
    storageId: v.id("_storage"),
  }).index("by_document", ["documentId"]),

  // The reader's note on one chapter. `content` is the editor's saved format (JSON), `plainText` a plain copy for AI.
  // `dismissed` with no text means "not now" was chosen at the end-of-chapter prompt, so it isn't asked again.
  reflections: defineTable({
    userId: v.id("users"),
    documentId: v.id("documents"),
    sectionKey: v.string(), // the chapter, a key from documents.sections
    content: v.optional(v.string()),
    plainText: v.optional(v.string()),
    dismissed: v.optional(v.boolean()),
  }).index("by_document_section", ["documentId", "sectionKey"]),

  // Chat with one book. A user row is one question (it also counts toward the daily limit); an assistant row is
  // the answer, with the pages it cites. `kind: "validate"` rows are note checks and `kind: "quiz"` rows are test
  // generations: they count toward the limit but are never shown.
  chatMessages: defineTable({
    userId: v.id("users"),
    documentId: v.id("documents"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    kind: v.optional(v.union(v.literal("chat"), v.literal("summary"), v.literal("validate"), v.literal("quiz"))),
    text: v.string(),
    citations: v.optional(v.array(v.object({ n: v.number(), page: v.number() }))),
  })
    .index("by_document", ["documentId"])
    .index("by_user", ["userId"]),

  // "Test yourself": one set of 5 questions per chapter, made once by the AI and reused. Answers stay on the server.
  quizzes: defineTable({
    userId: v.id("users"),
    documentId: v.id("documents"),
    chapterKey: v.string(),
    questions: v.array(quizQuestion),
  }).index("by_document_chapter", ["documentId", "chapterKey"]),

  // One go at a chapter's test. `review` rounds re-ask only missed questions and don't count toward the best score.
  quizAttempts: defineTable({
    userId: v.id("users"),
    documentId: v.id("documents"),
    chapterKey: v.string(),
    quizId: v.id("quizzes"),
    review: v.boolean(),
    results: v.array(v.object({ index: v.number(), choice: v.union(v.number(), v.null()), correct: v.union(v.boolean(), v.null()) })),
    score: v.number(),
    finished: v.boolean(),
  }).index("by_document_chapter", ["documentId", "chapterKey"]),

  // A readable piece of text with a locator (one page for a PDF). Chat searches these.
  chunks: defineTable({
    documentId: v.id("documents"),
    userId: v.id("users"),
    index: v.number(),
    text: v.string(),
    locator,
  })
    .index("by_document", ["documentId", "index"])
    .searchIndex("by_text", { searchField: "text", filterFields: ["documentId"] }),

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
    // End-of-course questions that connect pillars, built on demand.
    capstone: v.optional(
      v.object({
        status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
        error: v.optional(v.string()),
        checks: v.array(check),
      })
    ),
    // The placement check: one question per pillar, built on demand when the learner starts it.
    placement: v.optional(
      v.object({
        status: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed"), v.literal("skipped"), v.literal("done")),
        error: v.optional(v.string()),
        questions: v.array(v.object({ topicId: v.id("topics"), question })),
      })
    ),
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
    checks: v.array(check), // legacy: V1's 3 fixed questions; new lessons use `questions`
    questions: v.optional(v.array(question)), // the practice bank (6–8 mixed types)
    predict: v.optional(question), // asked BEFORE the lesson; not scored (pretesting)
    placement: v.optional(v.union(v.literal("known"), v.literal("shaky"), v.literal("new"))), // placement check result
  })
    .index("by_course", ["courseId", "order"])
    .index("by_user", ["userId"]),

  // Every check question a learner answers. One pillar → many answers.
  // topicId is empty for the end-of-course "connect" questions.
  answers: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    topicId: v.optional(v.id("topics")),
    checkId: v.string(),
    level: v.union(v.literal("apply"), v.literal("easier"), v.literal("stretch"), v.literal("connect")),
    type: v.optional(v.union(v.literal("choice"), v.literal("order"), v.literal("match"), v.literal("gap"))),
    context: v.optional(v.literal("review")), // empty = answered inside the lesson
    correct: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_topic", ["topicId"])
    .index("by_course", ["courseId"]),

  // Spaced review: one row per mastered pillar. See spacing.ts for the rules.
  reviews: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    topicId: v.id("topics"),
    dueAt: v.number(),
    intervalDays: v.number(),
    successes: v.number(),
    lastRecallAt: v.number(),
    longestGapDays: v.number(),
  })
    .index("by_user_due", ["userId", "dueAt"])
    .index("by_topic", ["topicId"]),

  // XP, level and streak: one row per user. Rules in gamification.ts.
  profiles: defineTable({
    userId: v.id("users"),
    xp: v.number(),
    streak: v.number(),
    longestStreak: v.number(),
    lastActiveDay: v.union(v.number(), v.null()), // local day number of the last answer
    freezes: v.number(),
  }).index("by_user", ["userId"]),

  // Earned achievements, each at most once per (user, kind, ref). earnedAt = _creationTime.
  achievements: defineTable({
    userId: v.id("users"),
    kind: v.string(), // e.g. pillar-mastered, ingrained, course-completed, streak-7, level-Thinker
    refId: v.string(), // the pillar or course it's about, or "" for one-offs
    label: v.string(), // "Pillar Mastered"
    subject: v.string(), // "Working Memory"
  })
    .index("by_user", ["userId"])
    .index("by_user_kind_ref", ["userId", "kind", "refId"]),

  // Junction table: "this user starred this topic". Many users ↔ many topics.
  stars: defineTable({
    userId: v.id("users"),
    topicId: v.id("topics"),
  })
    .index("by_user", ["userId"])
    .index("by_user_topic", ["userId", "topicId"])
    .index("by_topic", ["topicId"]),
});
