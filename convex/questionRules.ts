// Pure rules for the practice bank: clean what the AI writes, hide answers from the browser,
// and grade every question type. No AI judgment lives here.
import { mentionsSource } from "./lessonRules";
import { Check, Question, QuestionLevel } from "./lessonTypes";

const LEVELS = ["easier", "apply", "stretch"] as const;
const STYLES = ["apply", "spot", "why", "core"] as const;
const DEFAULT_LEVEL: Record<string, QuestionLevel> = {
  apply: "apply",
  spot: "apply",
  why: "stretch",
  core: "easier",
  order: "easier",
  match: "easier",
  gap: "easier",
};

type Raw = {
  type?: string;
  style?: string;
  level?: string;
  prompt?: string;
  question?: string;
  explanation?: string;
  options?: unknown[];
  answerIndex?: number;
  items?: unknown[];
  pairs?: { left?: unknown; right?: unknown }[];
  accepted?: unknown[];
};

const isStr = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const unique = (a: string[]) => new Set(a.map(normalize)).size === a.length;

function shuffle<T>(arr: T[], random: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A shuffled order of 0..n-1 that is never the identity, so the answer isn't given away.
function scramble(n: number, random: () => number) {
  const ids = [...Array(n).keys()];
  const s = shuffle(ids, random);
  return s.every((v, i) => v === i) ? ids.reverse() : s;
}

// Lowercase, no punctuation, no leading article: "The Feedback-Loop." → "feedback loop"
export function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^(a|an|the) /, "");
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// A typed answer counts if it matches an accepted one, allowing a typo in longer words.
export function gapMatches(typed: string, accepted: string[]) {
  const t = normalize(typed);
  if (!t) return false;
  return accepted.some((a) => {
    const n = normalize(a);
    const slack = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0;
    return editDistance(t, n) <= slack;
  });
}

function cleanOne(r: Raw, index: number, random: () => number): Question | null {
  const type = r.type;
  const prompt = (r.prompt ?? r.question ?? "").trim();
  const explanation = isStr(r.explanation) ? r.explanation.trim() : "";
  if (!prompt) return null;
  const style = STYLES.includes(r.style as (typeof STYLES)[number]) ? (r.style as (typeof STYLES)[number]) : "apply";
  const level: QuestionLevel = LEVELS.includes(r.level as QuestionLevel)
    ? (r.level as QuestionLevel)
    : DEFAULT_LEVEL[type === "choice" ? style : (type ?? "")] ?? "apply";
  const id = `${type}-${index}`;
  const base = { id, level, prompt, explanation };

  if (type === "choice") {
    const options = r.options ?? [];
    if (options.length !== 4 || !options.every(isStr) || !unique(options as string[])) return null;
    if (typeof r.answerIndex !== "number" || r.answerIndex < 0 || r.answerIndex > 3) return null;
    if ([prompt, ...(options as string[])].some(mentionsSource)) return null;
    const order = shuffle([0, 1, 2, 3], random);
    return { ...base, type, style, options: order.map((i) => options[i] as string), answerIndex: order.indexOf(r.answerIndex) };
  }

  if (type === "order") {
    const items = r.items ?? [];
    if (items.length < 3 || items.length > 6 || !items.every(isStr) || !unique(items as string[])) return null;
    if ([prompt, ...(items as string[])].some(mentionsSource)) return null;
    const shown = scramble(items.length, random); // shown[k] = original position of the k-th displayed item
    return {
      ...base,
      type,
      items: shown.map((i) => items[i] as string),
      answerOrder: items.map((_, original) => shown.indexOf(original)),
    };
  }

  if (type === "match") {
    const pairs = (r.pairs ?? []).filter((p) => isStr(p?.left) && isStr(p?.right)) as { left: string; right: string }[];
    if (pairs.length < 3 || pairs.length > 4 || pairs.length !== (r.pairs ?? []).length) return null;
    const left = pairs.map((p) => p.left);
    const rightSorted = pairs.map((p) => p.right);
    if (!unique(left) || !unique(rightSorted)) return null;
    if ([prompt, ...left, ...rightSorted].some(mentionsSource)) return null;
    const shown = scramble(pairs.length, random);
    return { ...base, type, left, right: shown.map((i) => rightSorted[i]), answerMap: left.map((_, i) => shown.indexOf(i)) };
  }

  if (type === "gap") {
    const blanks = prompt.replace(/_{3,}/g, "___");
    const accepted = (r.accepted ?? []).filter(isStr).map((a) => (a as string).trim()).slice(0, 5);
    if (blanks.split("___").length !== 2 || accepted.length === 0 || accepted.some((a) => a.length > 40)) return null;
    if (mentionsSource(blanks)) return null;
    // The answer can't already be sitting in the sentence.
    if (accepted.some((a) => ` ${normalize(blanks)} `.includes(` ${normalize(a)} `))) return null;
    return { ...base, type, prompt: blanks, accepted };
  }

  return null;
}

// Keeps the well-formed questions (max 8). Returns null if the bank is too thin to teach with:
// it needs 4+ questions, 3+ different types, and both an "apply" and an "easier" question.
export function cleanQuestions(
  raw: Raw[] | undefined,
  random = Math.random,
  onDrop?: (r: unknown) => void
): Question[] | null {
  const out: Question[] = [];
  (raw ?? []).forEach((r, i) => {
    const q = r && cleanOne(r, i, random);
    if (!q) onDrop?.(r);
    else if (out.length < 8) out.push(q);
  });
  const types = new Set(out.map((q) => q.type));
  const has = (l: QuestionLevel) => out.some((q) => q.level === l);
  return out.length >= 4 && types.size >= 3 && has("apply") && has("easier") ? out : null;
}

// V1 lessons stored 3 multiple-choice checks; serve them as choice questions.
export function bankOf(topic: { questions?: Question[]; checks: Check[] }): Question[] {
  if (topic.questions?.length) return topic.questions;
  return topic.checks
    .filter((c) => c.level !== "connect")
    .map((c) => ({
      id: c.id,
      type: "choice" as const,
      style: c.level === "easier" ? ("core" as const) : ("apply" as const),
      level: c.level as QuestionLevel,
      prompt: c.question,
      options: c.options,
      answerIndex: c.answerIndex,
      explanation: c.explanation,
    }));
}

// What the browser may see before answering: no answer keys, no explanations.
export function publicQuestion(q: Question) {
  const base = { id: q.id, level: q.level, prompt: q.prompt };
  switch (q.type) {
    case "choice":
      return { ...base, type: q.type, style: q.style, options: q.options };
    case "order":
      return { ...base, type: q.type, items: q.items };
    case "match":
      return { ...base, type: q.type, left: q.left, right: q.right };
    case "gap":
      return { ...base, type: q.type };
  }
}
export type PublicQuestion = ReturnType<typeof publicQuestion>;

export type Answer = number | number[] | string;
// solution: choice → answer index, order → item indices in order, match → right index per left, gap → the main accepted answer.
export type Graded = { correct: boolean; explanation: string; solution: number | number[] | string };

const sameList = (a: unknown, b: number[]) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

export function grade(q: Question, answer: Answer): Graded {
  const explanation = q.explanation;
  switch (q.type) {
    case "choice":
      return { correct: answer === q.answerIndex, explanation, solution: q.answerIndex };
    case "order":
      return { correct: sameList(answer, q.answerOrder), explanation, solution: q.answerOrder };
    case "match":
      return { correct: sameList(answer, q.answerMap), explanation, solution: q.answerMap };
    case "gap":
      return { correct: typeof answer === "string" && gapMatches(answer, q.accepted), explanation, solution: q.accepted[0] };
  }
}
