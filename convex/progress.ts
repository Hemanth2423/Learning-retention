// Pure helpers for mastery and dashboard stats (easy to unit test).

export function pct(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

export type Level = "apply" | "easier" | "stretch" | "connect";
export type Answer = { topicId?: string; level: Level; correct: boolean; _creationTime: number };
export type PillarState = "mastered" | "learning" | "untested";

// A pillar is mastered once the learner gets a scenario question (apply or stretch) right.
// Getting only the easier, direct question right isn't enough: it shows recall, not understanding.
export function pillarState(answers: Answer[]): PillarState {
  if (answers.length === 0) return "untested";
  return answers.some((a) => a.correct && (a.level === "apply" || a.level === "stretch")) ? "mastered" : "learning";
}

// One pillar's progress from its own answers: state plus % correct (null if never answered).
export function pillarProgress(answers: Answer[]) {
  const correct = answers.filter((a) => a.correct).length;
  return {
    state: pillarState(answers),
    correct,
    answered: answers.length,
    score: answers.length ? pct(correct, answers.length) : null,
  };
}

// What the map and path show for a pillar. Known = proved in the placement check, not yet confirmed by a review.
export type NodeState = "new" | "learning" | "learned" | "ingrained" | "known";
export function nodeState(p: { state: PillarState }, ingrained: boolean, placement?: "known" | "shaky" | "new"): NodeState {
  if (ingrained) return "ingrained";
  if (p.state === "mastered") return "learned";
  if (placement === "known") return "known";
  return p.state === "learning" ? "learning" : "new";
}

// Rough minutes left on the path: a full lesson for new ideas, less for ones you've started or guessed at.
export function pathMinutes(pillars: { node: NodeState; placement?: "known" | "shaky" | "new" }[]) {
  return pillars.reduce((m, p) => {
    if (p.node === "learned" || p.node === "ingrained" || p.node === "known") return m;
    return m + (p.node === "learning" || p.placement === "shaky" ? 4 : 6);
  }, 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Everything the dashboard shows, computed from one user's raw rows.
// tzOffsetMinutes is the browser's Date.getTimezoneOffset(), so days split at the learner's local midnight.
export function computeStats(courseCount: number, topicIds: string[], answers: Answer[], now: number, tzOffsetMinutes = 0) {
  const shift = tzOffsetMinutes * 60 * 1000;
  const correct = answers.filter((a) => a.correct).length;
  const mastered = topicIds.filter((id) => pillarState(answers.filter((a) => a.topicId === id)) === "mastered").length;

  // Accuracy per day, oldest first, for the chart.
  const byDay = new Map<number, { correct: number; total: number }>();
  for (const a of answers) {
    const day = Math.floor((a._creationTime - shift) / DAY_MS) * DAY_MS + shift; // local midnight
    const d = byDay.get(day) ?? { correct: 0, total: 0 };
    d.total++;
    if (a.correct) d.correct++;
    byDay.set(day, d);
  }
  const timeline = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day, d]) => ({ at: day, percent: pct(d.correct, d.total), count: d.total }));

  return {
    courseCount,
    topicCount: topicIds.length,
    mastered,
    accuracy: answers.length ? pct(correct, answers.length) : null,
    checksAnswered: answers.length,
    checksThisWeek: answers.filter((a) => now - a._creationTime < WEEK_MS).length,
    timeline,
  };
}
