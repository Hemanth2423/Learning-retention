import { describe, expect, test } from "vitest";
import { afterReview, DAY_MS, endOfToday, firstSchedule, isIngrained, nextInterval } from "./spacing";

const t0 = Date.UTC(2026, 10, 4, 18); // Nov 4, 6pm UTC

describe("spaced review", () => {
  test("first review is tomorrow, and gaps grow 1 → 3 → 7 → 21 → 53", () => {
    expect(firstSchedule(t0).dueAt).toBe(t0 + DAY_MS);
    expect([1, 3, 7, 21].map(nextInterval)).toEqual([3, 7, 21, 53]);
  });

  test("a miss brings it back tomorrow; a hit pushes it out", () => {
    const s = firstSchedule(t0);
    const missed = afterReview({ ...s, intervalDays: 7 }, false, t0 + DAY_MS);
    expect(missed.intervalDays).toBe(1);
    expect(missed.dueAt).toBe(t0 + 2 * DAY_MS);
    const hit = afterReview(s, true, t0 + DAY_MS);
    expect(hit).toMatchObject({ intervalDays: 3, successes: 1, longestGapDays: 1 });
  });

  test("a second correct recall on the same day doesn't count, but isn't left due", () => {
    const s = afterReview(firstSchedule(t0), true, t0 + DAY_MS);
    const again = afterReview(s, true, t0 + DAY_MS + 60_000);
    expect(again.successes).toBe(s.successes);
    expect(again.dueAt).toBeGreaterThanOrEqual(s.dueAt);
    // Same day as mastery, due already (e.g. a backfilled review): pushed out, not stuck on Today.
    const sameDay = afterReview({ ...firstSchedule(t0), dueAt: t0 }, true, t0 + 60_000);
    expect(sameDay).toMatchObject({ successes: 0, dueAt: t0 + 60_000 + DAY_MS });
  });

  test("ingrained needs 3 spaced recalls including a week-long gap", () => {
    let s = firstSchedule(t0);
    for (const d of [1, 4, 6]) s = afterReview(s, true, t0 + d * DAY_MS);
    expect(s.successes).toBe(3);
    expect(isIngrained(s)).toBe(false); // longest gap only 3 days
    s = afterReview(s, true, t0 + 13 * DAY_MS);
    expect(isIngrained(s)).toBe(true);
  });

  test("today ends at the learner's local midnight", () => {
    const pacific = 480; // UTC-8: 6pm UTC is 10am local; local midnight is 8am UTC the next day
    expect(endOfToday(t0, pacific)).toBe(Date.UTC(2026, 10, 5, 8) - 1);
  });
});
