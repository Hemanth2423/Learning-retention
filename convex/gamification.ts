// Pure reward rules (no database). Rewards point at what builds memory:
// effort, harder thinking, recovering from mistakes, and coming back on new days. Never cramming.
import { dayIndex } from "./spacing";

export type AnswerKind = {
  level: "easier" | "apply" | "stretch" | "connect";
  correct: boolean;
  review: boolean; // answered on the Today page
  comeback: boolean; // right after missing this pillar's previous question
};

const CORRECT_XP = { easier: 5, apply: 10, stretch: 15, connect: 15 };

// Every answer earns 2 (trying counts). Right answers earn more the harder they are.
// Reviews and comebacks earn a bonus.
export function xpFor(a: AnswerKind) {
  if (!a.correct) return 2;
  return 2 + CORRECT_XP[a.level] + (a.review ? 5 : 0) + (a.comeback ? 5 : 0);
}

export const LEVELS = [
  { name: "Curious", xp: 0 },
  { name: "Learner", xp: 100 },
  { name: "Thinker", xp: 300 },
  { name: "Expert", xp: 700 },
  { name: "Sage", xp: 1500 },
];

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1];
  return {
    index: i,
    name: LEVELS[i].name,
    next: next?.name ?? null,
    toNext: next ? next.xp - xp : 0,
    progress: next ? (xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp) : 1,
  };
}

export type Streak = { streak: number; longestStreak: number; lastActiveDay: number | null; freezes: number };

export const newStreak = (): Streak => ({ streak: 0, longestStreak: 0, lastActiveDay: null, freezes: 1 });

// Any answer on a new local day keeps the streak going. Missing exactly one day uses a freeze
// if you have one. A freeze is earned every 7 days of streak (max 2).
export function updateStreak(s: Streak, now: number, tz = 0): Streak & { usedFreeze: boolean } {
  const today = dayIndex(now, tz);
  if (s.lastActiveDay === today) return { ...s, usedFreeze: false };
  const gap = s.lastActiveDay === null ? Infinity : today - s.lastActiveDay;
  let { streak, freezes } = s;
  let usedFreeze = false;
  if (gap === 1) streak += 1;
  else if (gap === 2 && freezes > 0) {
    streak += 1;
    freezes -= 1;
    usedFreeze = true;
  } else streak = 1;
  if (streak > 0 && streak % 7 === 0) freezes = Math.min(2, freezes + 1);
  return { streak, longestStreak: Math.max(s.longestStreak, streak), lastActiveDay: today, freezes, usedFreeze };
}

export const STREAK_MILESTONES = [3, 7, 30];
