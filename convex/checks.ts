// Answering check questions (graded on the server) and the end-of-course "connect" questions.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { getOwnCourse, requireUser } from "./helpers";
import { cleanConnectChecks } from "./lessonRules";
import { check } from "./lessonTypes";
import { askJson } from "./llm";
import { bankOf, grade } from "./questionRules";
import { startReviews } from "./reviews";

// Grades one answer to a pillar's practice question and records it.
// The browser never sees the answer key before answering.
export const answerQuestion = mutation({
  args: {
    topicId: v.id("topics"),
    questionId: v.string(),
    answer: v.union(v.number(), v.array(v.number()), v.string()),
  },
  handler: async (ctx, { topicId, questionId, answer }) => {
    const userId = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.userId !== userId) throw new Error("Lesson not found.");
    const q = bankOf(topic).find((c) => c.id === questionId);
    if (!q) throw new Error("Question not found.");
    if (typeof answer === "string" && answer.length > 200) throw new Error("That answer is too long.");
    const graded = grade(q, answer);
    await ctx.db.insert("answers", {
      userId,
      courseId: topic.courseId,
      topicId,
      checkId: q.id,
      level: q.level,
      type: q.type,
      correct: graded.correct,
    });
    // Mastered (a Core or Stretch question right): start spaced review, first due tomorrow.
    if (graded.correct && q.level !== "easier") await startReviews(ctx, topic, Date.now());
    return graded;
  },
});

export const answerConnect = mutation({
  args: { courseId: v.id("courses"), checkId: v.string(), choice: v.number() },
  handler: async (ctx, { courseId, checkId, choice }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    const q = course?.capstone?.checks.find((c) => c.id === checkId);
    if (!q) throw new Error("Question not found.");
    const correct = choice === q.answerIndex;
    await ctx.db.insert("answers", { userId, courseId, checkId, level: "connect", correct });
    return { correct, answerIndex: q.answerIndex, explanation: q.explanation };
  },
});

// The predict-first guess: graded so we can reveal the answer, but NOT recorded.
// A guess before learning shouldn't count against accuracy or mastery.
export const answerPredict = mutation({
  args: { topicId: v.id("topics"), choice: v.number() },
  handler: async (ctx, { topicId, choice }) => {
    const userId = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.userId !== userId || !topic.predict) throw new Error("Question not found.");
    return grade(topic.predict, choice);
  },
});

// Builds the end-of-course questions on demand (only for courses people actually finish).
export const buildCapstone = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    if (!course || course.capstone?.status === "generating" || course.capstone?.status === "ready") return;
    await ctx.db.patch(courseId, { capstone: { status: "generating", checks: [] } });
    await ctx.scheduler.runAfter(0, internal.checks.generateCapstone, { courseId });
  },
});

export const capstoneContext = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const course = await ctx.db.get(courseId);
    if (!course) return null;
    const pillars = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return {
      title: course.title,
      thesis: course.thesis ?? "",
      links: course.conceptLinks ?? [],
      pillars: pillars.map((p) => ({ title: p.title, summary: p.summary, misconceptions: p.misconceptions })),
    };
  },
});

type ConnectReply = { checks: { question: string; options: string[]; answerIndex: number; explanation: string }[] };

export const generateCapstone = internalAction({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    try {
      const c = await ctx.runQuery(internal.checks.capstoneContext, { courseId });
      if (!c) return;
      const reply = await askJson<ConnectReply>(
        [
          {
            role: "system",
            content: `You write 3 final questions that test whether a learner can CONNECT the pillars of a course.
Each question is a short NEW real-world scenario that needs two pillars together to answer, ideally using a LINK.
4 plausible options (wrong ones based on the misconceptions), answerIndex 0–3, a 1–2 sentence explanation naming the pillars involved.
Test understanding, not recall. Never say "according to", "the source", "the text", "the author", "the chapter", or "the document".
Return JSON: { "checks": [{ "question": "...", "options": ["...", "...", "...", "..."], "answerIndex": 0, "explanation": "..." }] }`,
          },
          {
            role: "user",
            content: `COURSE: ${c.title}
BIG IDEA: ${c.thesis}
PILLARS:
${c.pillars.map((p) => `- ${p.title}: ${p.summary} (misconceptions: ${p.misconceptions.join("; ")})`).join("\n")}
LINKS: ${c.links.map((l) => `${l.from} → ${l.relation} → ${l.to}`).join("; ") || "(none)"}`,
          },
        ],
        { model: "deepseek-flash", label: "capstone" }
      );
      const checks = cleanConnectChecks(reply.checks);
      if (!checks) throw new Error("Couldn't write good connecting questions.");
      await ctx.runMutation(internal.checks.saveCapstone, { courseId, checks });
    } catch (err) {
      await ctx.runMutation(internal.checks.failCapstone, {
        courseId,
        error: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  },
});

export const saveCapstone = internalMutation({
  args: { courseId: v.id("courses"), checks: v.array(check) },
  handler: async (ctx, { courseId, checks }) => {
    if (await ctx.db.get(courseId)) await ctx.db.patch(courseId, { capstone: { status: "ready", checks } });
  },
});

export const failCapstone = internalMutation({
  args: { courseId: v.id("courses"), error: v.string() },
  handler: async (ctx, { courseId, error }) => {
    if (await ctx.db.get(courseId)) await ctx.db.patch(courseId, { capstone: { status: "failed", error, checks: [] } });
  },
});
