// Rules for "Test yourself": what a usable question is, shuffling, grading and scores.
// The AI only drafts questions; everything that must always hold is checked here.

export const QUIZ_SIZE = 5;
export const ASK_FOR = 6; // ask the AI for one spare, so one bad question doesn't sink the test
const MAX_QUESTION = 300;
const MAX_OPTION = 200;
const MAX_NOTE = 400;

// Stored on the server only. `answer` and the notes never reach the browser before an answer is given.
export type QuizQuestion = {
  question: string;
  options: string[]; // always 4
  answer: number; // index into options
  explanation: string; // why the right answer is right
  whyWrong: string[]; // per option: why that wrong option was tempting ("" for the right one)
  page?: number;
};

type RawWrong = { option?: unknown; why?: unknown };
type RawQuestion = { question?: unknown; correct?: unknown; wrong?: unknown; explanation?: unknown; page?: unknown };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "").slice(0, max + 1);
const CATCH_ALL = /\b(all|none|both|neither) of (the )?(above|these|them)\b|^(a|b|c|d) and (a|b|c|d)$/;
const same = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// The AI sometimes talks about "the passage"; the reader only knows the book.
export function tidy(s: string): string {
  const out = s
    .replace(/\b(according to|based on|as stated in|as described in) the (passages?|pages?|text|excerpts?)\b,?\s*/gi, "")
    .replace(/\bthe (passages?|excerpts?)\b/gi, "the chapter")
    .replace(/\s*\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// One AI question → a stored question, or null if it breaks a rule.
export function cleanQuestion(raw: RawQuestion, validPages: number[], random = Math.random): QuizQuestion | null {
  const question = tidy(text(raw.question, MAX_QUESTION));
  const correct = text(raw.correct, MAX_OPTION);
  const explanation = tidy(text(raw.explanation, MAX_NOTE));
  if (!question || question.length > MAX_QUESTION || !correct || correct.length > MAX_OPTION || !explanation) return null;
  if (!Array.isArray(raw.wrong) || raw.wrong.length !== 3) return null;

  const wrong = (raw.wrong as RawWrong[]).map((w) => ({ option: text(w?.option, MAX_OPTION), why: tidy(text(w?.why, MAX_NOTE)).slice(0, MAX_NOTE) }));
  if (wrong.some((w) => !w.option || w.option.length > MAX_OPTION)) return null;
  const keys = [correct, ...wrong.map((w) => w.option)].map(same);
  if (keys.some((k) => !k) || new Set(keys).size !== 4) return null; // 4 different options
  if (keys.some((k) => CATCH_ALL.test(k))) return null; // every option must stand on its own

  const order = shuffle([{ option: correct, why: "", right: true }, ...wrong.map((w) => ({ ...w, right: false }))], random);
  const page = typeof raw.page === "number" && validPages.includes(raw.page) ? raw.page : undefined;
  return {
    question,
    options: order.map((o) => o.option),
    answer: order.findIndex((o) => o.right),
    explanation: explanation.slice(0, MAX_NOTE),
    whyWrong: order.map((o) => o.why),
    ...(page !== undefined ? { page } : {}),
  };
}

// The AI's whole reply → exactly QUIZ_SIZE usable, different questions, or null.
export function cleanQuiz(raw: unknown, validPages: number[], random = Math.random): QuizQuestion[] | null {
  const list = (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return null;
  const out: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    if (out.length === QUIZ_SIZE) break;
    if (!r || typeof r !== "object") continue;
    const q = cleanQuestion(r as RawQuestion, validPages, random);
    if (!q || seen.has(same(q.question))) continue;
    seen.add(same(q.question));
    out.push(q);
  }
  return out.length === QUIZ_SIZE ? out : null;
}

// What the browser sees before answering.
export function publicQuestion(q: QuizQuestion) {
  return { question: q.question, options: q.options };
}
export type PublicQuizQuestion = ReturnType<typeof publicQuestion>;

export type Feedback = { correct: boolean; answer: number; explanation: string; whyWrong: string; page?: number };

export function gradeChoice(q: QuizQuestion, choice: number): Feedback {
  const correct = choice === q.answer;
  return { correct, answer: q.answer, explanation: q.explanation, whyWrong: correct ? "" : (q.whyWrong[choice] ?? ""), page: q.page };
}

// An attempt's results: one entry per asked question; null = not answered yet.
export type Result = { index: number; choice: number | null; correct: boolean | null };

export const scoreOf = (results: Result[]) => results.filter((r) => r.correct === true).length;
export const isFinished = (results: Result[]) => results.length > 0 && results.every((r) => r.correct !== null);
export const missedOf = (results: Result[]) => results.filter((r) => r.correct === false).map((r) => r.index);

// The path shows the best full test (review rounds don't count: they only re-ask missed questions).
export function bestScore(attempts: { review: boolean; finished: boolean; score: number }[]): number | null {
  const full = attempts.filter((a) => !a.review && a.finished);
  return full.length ? Math.max(...full.map((a) => a.score)) : null;
}
