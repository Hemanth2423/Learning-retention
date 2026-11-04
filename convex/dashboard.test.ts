import { describe, expect, test } from "vitest";
import { computeStats } from "./progress";

// Given a user has quiz attempts scoring 4/5, 3/5, and 5/5,
// when the dashboard stats are computed,
// then the average quiz score is exactly 80% and quizzes taken = 3.
describe("dashboard stats", () => {
  test("average quiz score is calculated correctly", () => {
    const now = Date.UTC(2026, 10, 3);
    const day = 24 * 60 * 60 * 1000;
    const attempts = [
      { topicId: "t1", score: 4, total: 5, _creationTime: now - 1 * day }, // 80%
      { topicId: "t1", score: 3, total: 5, _creationTime: now - 2 * day }, // 60%
      { topicId: "t2", score: 5, total: 5, _creationTime: now - 10 * day }, // 100%, older than a week
    ];

    const stats = computeStats(1, ["t1", "t2", "t3"], attempts, now);

    expect(stats.averageScore).toBe(80); // (80 + 60 + 100) / 3
    expect(stats.quizzesTaken).toBe(3);
    expect(stats.quizzesThisWeek).toBe(2);
    expect(stats.mastered).toBe(2); // t1 best 80%, t2 best 100%, t3 untested
  });

  test("average is empty (not 0%) before any quiz", () => {
    expect(computeStats(0, [], [], Date.now()).averageScore).toBeNull();
  });
});
