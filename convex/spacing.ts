// Pure spaced-review rules (no database). Days split at the learner's local midnight:
// tzOffsetMinutes is the browser's Date.getTimezoneOffset().

export const DAY_MS = 24 * 60 * 60 * 1000;
const LADDER = [1, 3, 7, 21]; // days between reviews; after 21, each gap is 2.5× the last

export type Schedule = {
  dueAt: number;
  intervalDays: number;
  successes: number; // successful review recalls, at most one per day
  lastRecallAt: number; // when the idea was last recalled correctly (mastery counts)
  longestGapDays: number; // longest gap, in days, bridged by a correct recall
};

export const dayIndex = (t: number, tz = 0) => Math.floor((t - tz * 60_000) / DAY_MS);
// Last moment of the learner's local today: everything due before it shows on Today.
export const endOfToday = (now: number, tz = 0) => (dayIndex(now, tz) + 1) * DAY_MS + tz * 60_000 - 1;

export function nextInterval(days: number) {
  const i = LADDER.indexOf(days);
  if (i >= 0 && i < LADDER.length - 1) return LADDER[i + 1];
  return days < LADDER[0] ? LADDER[0] : Math.round(days * 2.5);
}

// Mastering a pillar starts its schedule. The first review is tomorrow, after a night's sleep.
export function firstSchedule(now: number): Schedule {
  return { dueAt: now + DAY_MS, intervalDays: 1, successes: 0, lastRecallAt: now, longestGapDays: 0 };
}

// After a review answer. Right → the gap grows. A miss → back tomorrow.
// A second correct recall on the same day doesn't count again (spacing is the point),
// but it still clears today's review so it doesn't stay due.
export function afterReview(s: Schedule, correct: boolean, now: number, tz = 0): Schedule {
  if (!correct) return { ...s, intervalDays: 1, dueAt: now + DAY_MS };
  const gap = dayIndex(now, tz) - dayIndex(s.lastRecallAt, tz);
  if (gap === 0) return { ...s, dueAt: Math.max(s.dueAt, now + s.intervalDays * DAY_MS) };
  const intervalDays = nextInterval(s.intervalDays);
  return {
    dueAt: now + intervalDays * DAY_MS,
    intervalDays,
    successes: s.successes + 1,
    lastRecallAt: now,
    longestGapDays: Math.max(s.longestGapDays, gap),
  };
}

// Ingrained: recalled correctly in 3 reviews on different days, with at least one gap of a week or more.
export function isIngrained(s: Pick<Schedule, "successes" | "longestGapDays">) {
  return s.successes >= 3 && s.longestGapDays >= 7;
}
