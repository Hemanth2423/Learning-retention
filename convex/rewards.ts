// XP, streaks and achievements: written after every graded answer, read by the header and achievements page.
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, query } from "./_generated/server";
import { levelFor, newStreak, STREAK_MILESTONES, updateStreak, xpFor } from "./gamification";
import { requireUser } from "./helpers";
import { pillarState } from "./progress";
import { dayIndex } from "./spacing";

export type Reward = { xp: number; achievements: string[]; levelUp: string | null; streak: number };

// Inserts the achievement unless this user already has it. Returns its display text if new.
export async function award(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: string,
  refId: string,
  label: string,
  subject: string
) {
  const existing = await ctx.db
    .query("achievements")
    .withIndex("by_user_kind_ref", (q) => q.eq("userId", userId).eq("kind", kind).eq("refId", refId))
    .first();
  if (existing) return null;
  await ctx.db.insert("achievements", { userId, kind, refId, label, subject });
  return `${label}: ${subject}`;
}

async function getProfile(ctx: MutationCtx, userId: Id<"users">) {
  const p = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (p) return p;
  const id = await ctx.db.insert("profiles", { userId, xp: 0, ...newStreak() });
  return (await ctx.db.get(id))!;
}

// Call right AFTER inserting the answer row. Updates XP and streak and awards any new achievements.
export async function recordActivity(
  ctx: MutationCtx,
  a: {
    userId: Id<"users">;
    courseId: Id<"courses">;
    topic: Doc<"topics"> | null; // null for end-of-course questions
    level: "easier" | "apply" | "stretch" | "connect";
    correct: boolean;
    review: boolean;
    tz: number;
  }
): Promise<Reward> {
  const now = Date.now();
  const got: (string | null)[] = [];

  // Comeback: right after a miss on the same pillar. Newest first; [0] is this answer.
  const recent = a.topic
    ? await ctx.db
        .query("answers")
        .withIndex("by_topic", (q) => q.eq("topicId", a.topic!._id))
        .order("desc")
        .take(3)
    : [];
  const comeback = a.correct && recent[1] !== undefined && !recent[1].correct;
  if (a.correct && a.topic && recent.length === 3 && !recent[1].correct && !recent[2].correct)
    got.push(await award(ctx, a.userId, "comeback", a.topic._id, "Comeback", a.topic.title));

  // XP, level, streak
  const profile = await getProfile(ctx, a.userId);
  const xp = xpFor({ level: a.level, correct: a.correct, review: a.review, comeback });
  const before = levelFor(profile.xp);
  const after = levelFor(profile.xp + xp);
  const s = updateStreak(profile, now, a.tz);
  const streak = { streak: s.streak, longestStreak: s.longestStreak, lastActiveDay: s.lastActiveDay, freezes: s.freezes };
  await ctx.db.patch(profile._id, { ...streak, xp: profile.xp + xp });

  got.push(await award(ctx, a.userId, "first-answer", "", "First Step", "Answered your first question"));
  for (const m of STREAK_MILESTONES)
    if (streak.streak >= m) got.push(await award(ctx, a.userId, `streak-${m}`, "", "Streak", `${m} days in a row`));
  if (after.index > before.index) got.push(await award(ctx, a.userId, `level-${after.name}`, "", "Level Up", after.name));

  // Mastery (a Core or Stretch question right), and the whole course once every pillar is mastered.
  if (a.correct && a.topic && (a.level === "apply" || a.level === "stretch")) {
    got.push(await award(ctx, a.userId, "pillar-mastered", a.topic._id, "Pillar Mastered", a.topic.title));
    const [pillars, answers] = await Promise.all([
      ctx.db.query("topics").withIndex("by_course", (q) => q.eq("courseId", a.courseId)).collect(),
      ctx.db.query("answers").withIndex("by_course", (q) => q.eq("courseId", a.courseId)).collect(),
    ]);
    if (pillars.every((p) => pillarState(answers.filter((x) => x.topicId === p._id)) === "mastered")) {
      const course = await ctx.db.get(a.courseId);
      got.push(await award(ctx, a.userId, "course-completed", a.courseId, "Course Completed", course?.title ?? ""));
    }
  }

  return {
    xp,
    achievements: got.filter((g): g is string => g !== null),
    levelUp: after.index > before.index ? after.name : null,
    streak: streak.streak,
  };
}

// Header chip and achievements page.
export const me = query({
  args: { tzOffsetMinutes: v.number() },
  handler: async (ctx, { tzOffsetMinutes }) => {
    const userId = await requireUser(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const achievements = await ctx.db
      .query("achievements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const xp = profile?.xp ?? 0;
    // The streak is still alive if you answered yesterday (or the day before, with a freeze left).
    const gap = profile?.lastActiveDay == null ? Infinity : dayIndex(Date.now(), tzOffsetMinutes) - profile.lastActiveDay;
    const alive = gap <= 1 || (gap === 2 && (profile?.freezes ?? 0) > 0);
    return {
      xp,
      level: levelFor(xp),
      streak: alive ? (profile?.streak ?? 0) : 0,
      activeToday: gap === 0,
      longestStreak: profile?.longestStreak ?? 0,
      freezes: profile?.freezes ?? 1,
      achievements: achievements.map((x) => ({ id: x._id, kind: x.kind, label: x.label, subject: x.subject, earnedAt: x._creationTime })),
    };
  },
});
