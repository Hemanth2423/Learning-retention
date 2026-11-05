// The placement check: one question per pillar to find what the learner already knows.
// Built on demand (one small flash call per course), from the concept model only.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { getOwnCourse, requireUser } from "./helpers";
import { question } from "./lessonTypes";
import { askJson } from "./llm";
import { cleanPredict, grade } from "./questionRules";
import { startReviews } from "./reviews";

export const DONT_KNOW = -1;

export const build = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    if (!course || course.status !== "ready") return;
    if (course.placement && course.placement.status !== "failed") return;
    await ctx.db.patch(courseId, { placement: { status: "generating", questions: [] } });
    await ctx.scheduler.runAfter(0, internal.placement.generate, { courseId });
  },
});

export const skip = mutation({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    if (!course) throw new Error("Course not found.");
    await ctx.db.patch(courseId, { placement: { status: "skipped", questions: course.placement?.questions ?? [] } });
  },
});

// choice = DONT_KNOW for "I don't know yet". Right → Known (straight to spaced review), wrong → Shaky, don't know → New.
// Not saved to `answers`: a diagnostic guess shouldn't count toward accuracy or mastery.
export const answer = mutation({
  args: { courseId: v.id("courses"), topicId: v.id("topics"), choice: v.number() },
  handler: async (ctx, { courseId, topicId, choice }) => {
    const userId = await requireUser(ctx);
    const course = await getOwnCourse(ctx, userId, courseId);
    const item = course?.placement?.questions.find((x) => x.topicId === topicId);
    const topic = await ctx.db.get(topicId);
    if (!course || !item || !topic || topic.userId !== userId) throw new Error("Question not found.");
    const graded = grade(item.question, choice);
    const result = choice === DONT_KNOW ? "new" : graded.correct ? "known" : "shaky";
    await ctx.db.patch(topicId, { placement: result });
    if (result === "known") await startReviews(ctx, topic, Date.now());

    // Done once every question has a result.
    const results = await Promise.all(course.placement!.questions.map((x) => ctx.db.get(x.topicId)));
    if (results.every((t) => t?.placement)) await ctx.db.patch(courseId, { placement: { ...course.placement!, status: "done" } });
    return { ...graded, result };
  },
});

export const context = internalQuery({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    const course = await ctx.db.get(courseId);
    const pillars = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", courseId))
      .collect();
    return course && { title: course.title, thesis: course.thesis ?? "", pillars };
  },
});

type Reply = { questions: { pillar: number; prompt: string; options: string[]; answerIndex: number; explanation: string }[] };

export const generate = internalAction({
  args: { courseId: v.id("courses") },
  handler: async (ctx, { courseId }) => {
    try {
      const c = await ctx.runQuery(internal.placement.context, { courseId });
      if (!c) return;
      const reply = await askJson<Reply>(
        [
          {
            role: "system",
            content: `You write a short PLACEMENT CHECK: one question per pillar, to find out whether a learner ALREADY understands it before any lesson.
Each question is a short, concrete scenario where someone who truly gets the idea picks the right option and someone who doesn't is tempted by a misconception.
4 plausible options (wrong ones based on the misconceptions), answerIndex 0–3, and a 1–2 sentence explanation.
Test understanding, not vocabulary. Never say "according to", "the source", "the author", "this chapter", or "the text says".
Return JSON: { "questions": [{ "pillar": <pillar number>, "prompt": "...", "options": ["...", "...", "...", "..."], "answerIndex": 0, "explanation": "..." }] }`,
          },
          {
            role: "user",
            content: `COURSE: ${c.title}
BIG IDEA: ${c.thesis}
PILLARS:
${c.pillars.map((p, i) => `${i + 1}. ${p.title}: ${p.summary}\n   insights: ${p.insights.map((x) => x.text).join("; ")}\n   misconceptions: ${p.misconceptions.join("; ")}`).join("\n")}`,
          },
        ],
        { model: "deepseek-flash", label: "placement" }
      );
      const questions: { topicId: Id<"topics">; question: NonNullable<ReturnType<typeof cleanPredict>> }[] = [];
      for (const r of reply.questions ?? []) {
        const pillar = c.pillars[r.pillar - 1];
        const q = cleanPredict(r);
        if (pillar && q && !questions.some((x) => x.topicId === pillar._id))
          questions.push({ topicId: pillar._id, question: { ...q, id: `placement-${pillar._id}` } });
      }
      if (questions.length < Math.min(2, c.pillars.length)) throw new Error("Couldn't write a good placement check.");
      questions.sort((a, b) => c.pillars.findIndex((p) => p._id === a.topicId) - c.pillars.findIndex((p) => p._id === b.topicId));
      await ctx.runMutation(internal.placement.save, { courseId, questions });
    } catch (err) {
      await ctx.runMutation(internal.placement.fail, {
        courseId,
        error: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  },
});

export const save = internalMutation({
  args: { courseId: v.id("courses"), questions: v.array(v.object({ topicId: v.id("topics"), question })) },
  handler: async (ctx, { courseId, questions }) => {
    if (await ctx.db.get(courseId)) await ctx.db.patch(courseId, { placement: { status: "ready", questions } });
  },
});

export const fail = internalMutation({
  args: { courseId: v.id("courses"), error: v.string() },
  handler: async (ctx, { courseId, error }) => {
    if (await ctx.db.get(courseId)) await ctx.db.patch(courseId, { placement: { status: "failed", error, questions: [] } });
  },
});
