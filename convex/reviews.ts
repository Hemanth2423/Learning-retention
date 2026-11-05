// Spaced review: scheduling, the Today session, and answering reviews.
// Reviews reuse each pillar's stored question bank, so they cost no AI tokens.
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, MutationCtx, query } from "./_generated/server";
import { requireUser } from "./helpers";
import { pillarState } from "./progress";
import { bankOf, grade, publicQuestion } from "./questionRules";
import { afterReview, dayIndex, endOfToday, firstSchedule, isIngrained } from "./spacing";

const SESSION = 5;

// Called when a lesson answer masters a pillar: starts its schedule if it hasn't one yet.
export async function startReviews(ctx: MutationCtx, topic: Doc<"topics">, now: number) {
  const existing = await ctx.db
    .query("reviews")
    .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
    .first();
  if (existing) return;
  await ctx.db.insert("reviews", { userId: topic.userId, courseId: topic.courseId, topicId: topic._id, ...firstSchedule(now) });
}

// Mixes pillars from different courses: one from each course in turn (interleaving).
function interleave<T extends { courseId: Id<"courses"> }>(rows: T[]) {
  const byCourse = new Map<string, T[]>();
  for (const r of rows) byCourse.set(r.courseId, [...(byCourse.get(r.courseId) ?? []), r]);
  const queues = [...byCourse.values()];
  const out: T[] = [];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  return out;
}

// Which question a review asks: a scenario (not the warm-up), rotating so it's not the same one each time.
function pickQuestion(topic: Doc<"topics">, review: Doc<"reviews">, now: number, tz: number) {
  const bank = bankOf(topic);
  const scenario = bank.filter((q) => q.level !== "easier");
  const pool = scenario.length ? scenario : bank;
  return pool.length ? pool[(review.successes + dayIndex(now, tz)) % pool.length] : null;
}

// The Today page: what's due by the end of the learner's local day, mixed across courses.
export const today = query({
  args: { tzOffsetMinutes: v.number() },
  handler: async (ctx, { tzOffsetMinutes }) => {
    const userId = await requireUser(ctx);
    const now = Date.now();
    const all = await ctx.db
      .query("reviews")
      .withIndex("by_user_due", (q) => q.eq("userId", userId))
      .collect();
    const due = all.filter((r) => r.dueAt <= endOfToday(now, tzOffsetMinutes));
    const items = [];
    for (const r of interleave(due).slice(0, SESSION)) {
      const topic = await ctx.db.get(r.topicId);
      const course = await ctx.db.get(r.courseId);
      const q = topic && pickQuestion(topic, r, now, tzOffsetMinutes);
      if (!topic || !course || !q) continue;
      items.push({ topicId: topic._id, topicTitle: topic.title, courseTitle: course.title, question: publicQuestion(q) });
    }
    const later = all.filter((r) => r.dueAt > endOfToday(now, tzOffsetMinutes)).map((r) => r.dueAt);
    return {
      dueCount: due.length,
      items,
      nextDueAt: later.length ? Math.min(...later) : null,
      tomorrowCount: all.filter((r) => r.dueAt <= endOfToday(now + 86_400_000, tzOffsetMinutes)).length - due.length,
      ingrainedCount: all.filter(isIngrained).length,
      scheduledCount: all.length,
    };
  },
});

// Just the number for the nav badge.
export const dueCount = query({
  args: { tzOffsetMinutes: v.number() },
  handler: async (ctx, { tzOffsetMinutes }) => {
    const userId = await requireUser(ctx);
    const due = await ctx.db
      .query("reviews")
      .withIndex("by_user_due", (q) => q.eq("userId", userId).lte("dueAt", endOfToday(Date.now(), tzOffsetMinutes)))
      .collect();
    return due.length;
  },
});

// Grades one review answer, records it, and moves the pillar's schedule.
export const answer = mutation({
  args: {
    topicId: v.id("topics"),
    questionId: v.string(),
    answer: v.union(v.number(), v.array(v.number()), v.string()),
    tzOffsetMinutes: v.number(),
  },
  handler: async (ctx, { topicId, questionId, answer, tzOffsetMinutes }) => {
    const userId = await requireUser(ctx);
    const topic = await ctx.db.get(topicId);
    if (!topic || topic.userId !== userId) throw new Error("Review not found.");
    const review = await ctx.db
      .query("reviews")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .first();
    const q = bankOf(topic).find((x) => x.id === questionId);
    if (!review || !q) throw new Error("Review not found.");
    if (typeof answer === "string" && answer.length > 200) throw new Error("That answer is too long.");

    const graded = grade(q, answer);
    await ctx.db.insert("answers", {
      userId,
      courseId: topic.courseId,
      topicId,
      checkId: q.id,
      level: q.level,
      type: q.type,
      context: "review",
      correct: graded.correct,
    });
    const { _id, _creationTime, userId: _u, courseId: _c, topicId: _t, ...schedule } = review;
    const next = afterReview(schedule, graded.correct, Date.now(), tzOffsetMinutes);
    await ctx.db.patch(_id, next);
    return {
      ...graded,
      nextDueAt: next.dueAt,
      ingrained: isIngrained(next),
      justIngrained: isIngrained(next) && !isIngrained(schedule),
    };
  },
});

// One-time: pillars mastered before reviews existed get a schedule, due today.
export const backfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    let added = 0;
    for (const topic of await ctx.db.query("topics").collect()) {
      const answers = await ctx.db
        .query("answers")
        .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
        .collect();
      if (pillarState(answers) !== "mastered") continue;
      const existing = await ctx.db
        .query("reviews")
        .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
        .first();
      if (existing) continue;
      const masteredAt = Math.max(...answers.filter((a) => a.correct).map((a) => a._creationTime));
      await ctx.db.insert("reviews", {
        userId: topic.userId,
        courseId: topic.courseId,
        topicId: topic._id,
        ...firstSchedule(masteredAt),
        dueAt: Math.min(Date.now(), masteredAt + 86_400_000),
      });
      added++;
    }
    return added;
  },
});
