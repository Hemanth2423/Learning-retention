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
