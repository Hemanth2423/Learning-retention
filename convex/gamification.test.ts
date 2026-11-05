import { describe, expect, test } from "vitest";
import { levelFor, newStreak, updateStreak, xpFor } from "./gamification";
import { DAY_MS } from "./spacing";

const base = { review: false, comeback: false };
const t0 = Date.UTC(2026, 10, 4, 18); // Nov 4, 6pm UTC

describe("XP", () => {
  test("trying earns a little, harder right answers earn more, reviews and comebacks add a bonus", () => {
    expect(xpFor({ ...base, level: "apply", correct: false })).toBe(2);
    expect(xpFor({ ...base, level: "easier", correct: true })).toBe(7);
    expect(xpFor({ ...base, level: "stretch", correct: true })).toBe(17);
    expect(xpFor({ level: "apply", correct: true, review: true, comeback: true })).toBe(22);
  });

  test("levels and progress to the next one", () => {
    expect(levelFor(0)).toMatchObject({ name: "Curious", next: "Learner", toNext: 100, progress: 0 });
    expect(levelFor(150)).toMatchObject({ name: "Learner", toNext: 150, progress: 0.25 });
    expect(levelFor(5000)).toMatchObject({ name: "Sage", next: null, progress: 1 });
  });
});

describe("streak", () => {
  test("counts once per day, grows on consecutive days, resets after a long gap", () => {
    let s = updateStreak(newStreak(), t0);
    expect(s.streak).toBe(1);
    expect(updateStreak(s, t0 + 60_000).streak).toBe(1); // same day
    s = updateStreak(s, t0 + DAY_MS);
    expect(s.streak).toBe(2);
    expect(updateStreak(s, t0 + 5 * DAY_MS).streak).toBe(1);
  });

  test("a freeze covers one missed day, then it's used up", () => {
    let s = updateStreak(newStreak(), t0); // starts with 1 freeze
    s = updateStreak(s, t0 + 2 * DAY_MS);
    expect(s).toMatchObject({ streak: 2, freezes: 0, usedFreeze: true });
    s = updateStreak(s, t0 + 4 * DAY_MS);
    expect(s.streak).toBe(1);
  });

  test("days split at the learner's local midnight, not UTC", () => {
    const pacific = 480; // UTC-8
    const lateEvening = Date.UTC(2026, 10, 5, 7); // Nov 4, 11pm in California
    const nextMorning = Date.UTC(2026, 10, 5, 9); // Nov 5, 1am in California
    const s = updateStreak(newStreak(), lateEvening, pacific);
    expect(updateStreak(s, nextMorning, pacific).streak).toBe(2);
    expect(updateStreak(updateStreak(newStreak(), lateEvening, 0), nextMorning, 0).streak).toBe(1); // same UTC day
  });

  test("a 7-day streak earns a freeze, up to 2", () => {
    let s = newStreak();
    for (let d = 0; d < 7; d++) s = updateStreak(s, t0 + d * DAY_MS);
    expect(s).toMatchObject({ streak: 7, freezes: 2, longestStreak: 7 });
  });
});
