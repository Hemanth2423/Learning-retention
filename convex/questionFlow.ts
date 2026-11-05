// Picks the next practice question (pure, shared by the browser and tests).
// Start at "apply". A right answer moves up a level, a miss moves down to an easier one.
// Among questions at the closest level, prefer a different type from the last one, for variety.

export const SESSION_LENGTH = 5;
const LADDER = ["easier", "apply", "stretch"] as const;

type Q = { id: string; type: string; level: (typeof LADDER)[number] };
export type Done = { id: string; correct: boolean };

export function nextQuestion<T extends Q>(bank: T[], done: Done[], max = SESSION_LENGTH): T | null {
  if (done.length >= Math.min(max, bank.length)) return null;
  const remaining = bank.filter((q) => !done.some((d) => d.id === q.id));
  const last = done.at(-1);
  const lastQ = last ? bank.find((q) => q.id === last.id) : undefined;
  const target = lastQ
    ? Math.max(0, Math.min(2, LADDER.indexOf(lastQ.level) + (last!.correct ? 1 : -1)))
    : LADDER.indexOf("apply");
  const cost = (q: T) => Math.abs(LADDER.indexOf(q.level) - target) * 10 + (q.type === lastQ?.type ? 1 : 0);
  return remaining.reduce<T | null>((best, q) => (best === null || cost(q) < cost(best) ? q : best), null);
}
