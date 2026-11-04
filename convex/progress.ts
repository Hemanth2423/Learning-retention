// Pure helpers for scoring and mastery (easy to unit test).

export const MASTERY_PCT = 80;

export function pct(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

// Best score (as %) across a topic's attempts, or null if never attempted.
export function bestPct(attempts: { score: number; total: number }[]): number | null {
  if (attempts.length === 0) return null;
  return Math.max(...attempts.map((a) => pct(a.score, a.total)));
}

export function isMastered(best: number | null): boolean {
  return best !== null && best >= MASTERY_PCT;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Attempt = { topicId: string; score: number; total: number; _creationTime: number };

// Everything the dashboard shows, computed from one user's raw rows.
export function computeStats(
  courseCount: number,
  topicIds: string[],
  attempts: Attempt[],
  now: number
) {
  const percents = attempts.map((a) => pct(a.score, a.total));
  const averageScore =
    percents.length > 0 ? Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length) : null;
  const mastered = topicIds.filter((id) => isMastered(bestPct(attempts.filter((a) => a.topicId === id)))).length;
  const quizzesThisWeek = attempts.filter((a) => now - a._creationTime < WEEK_MS).length;
  const timeline = [...attempts]
    .sort((a, b) => a._creationTime - b._creationTime)
    .map((a) => ({ at: a._creationTime, percent: pct(a.score, a.total) }));
  return {
    courseCount,
    topicCount: topicIds.length,
    mastered,
    averageScore,
    quizzesTaken: attempts.length,
    quizzesThisWeek,
    timeline,
  };
}
