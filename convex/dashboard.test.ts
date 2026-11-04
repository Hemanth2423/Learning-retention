import { describe, expect, test } from "vitest";
import { computeStats } from "./progress";

// Given a user answered 5 check questions (3 right, 2 wrong) across 3 pillars,
// when the dashboard stats are computed,
// then accuracy is exactly 60%, 5 answered, 3 this week, and 2 pillars mastered
// (mastery needs a scenario question right; the easier question alone doesn't count).
describe("dashboard stats", () => {
  test("accuracy and mastery are calculated correctly", () => {
    const now = Date.UTC(2026, 10, 4);
    const day = 24 * 60 * 60 * 1000;
    const answers = [
      { topicId: "t1", level: "apply" as const, correct: true, _creationTime: now - 1 * day }, // t1 mastered
      { topicId: "t2", level: "apply" as const, correct: false, _creationTime: now - 2 * day },
      { topicId: "t2", level: "easier" as const, correct: false, _creationTime: now - 2 * day },
      { topicId: "t2", level: "stretch" as const, correct: true, _creationTime: now - 10 * day }, // t2 mastered, older than a week
      { topicId: "t3", level: "easier" as const, correct: true, _creationTime: now - 12 * day }, // t3 only "learning"
    ];

    const stats = computeStats(1, ["t1", "t2", "t3", "t4"], answers, now);

    expect(stats.accuracy).toBe(60); // 3 of 5 correct
    expect(stats.checksAnswered).toBe(5);
    expect(stats.checksThisWeek).toBe(3);
    expect(stats.mastered).toBe(2); // t1, t2 — not t3 (easier only), not t4 (untested)
  });

  test("accuracy is empty (not 0%) before any answer", () => {
    expect(computeStats(0, [], [], Date.now()).accuracy).toBeNull();
  });
});

test("chart days split at the learner's local midnight", () => {
  // 7:30 am UTC on Nov 4 is 11:30 pm Nov 3 in California (UTC−8 → offset +480 minutes).
  const at = Date.UTC(2026, 10, 4, 7, 30);
  const [point] = computeStats(0, [], [{ level: "apply", correct: true, _creationTime: at }], at, 480).timeline;
  expect(new Date(point.at).toISOString()).toBe("2026-11-03T08:00:00.000Z"); // = Nov 3, 00:00 Pacific
});
