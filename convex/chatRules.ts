// Pure rules for chat: the daily limit, finding and ranking passages, and checking what the AI sends back.
// Rules that must always hold live here in code, not in the prompt. Tested in chatRules.test.ts.

export const DAILY_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_QUESTION = 1000;

// ---- The daily limit (rolling 24 hours) ----

export function quotaStatus(askedAt: number[], now: number, limit = DAILY_LIMIT) {
  const recent = askedAt.filter((t) => t > now - DAY_MS).sort((a, b) => a - b);
  const left = Math.max(0, limit - recent.length);
  // When no questions are left, the next one frees up as the oldest counted question turns 24 hours old.
  const resetAt = left === 0 ? recent[recent.length - limit] + DAY_MS : null;
  return { used: recent.length, left, resetAt };
}

// ---- Finding passages ----

const STOP_WORDS = new Set(
  ("a an and are as at be but by can did do does for from had has have how i if in into is it its me my of on or our so than that the their them then there these they this to was we were what when where which who why will with would you your about book author chapter say says said explain tell mean means").split(" ")
);

// The words worth searching for. The search finds pages that contain them.
export function keywords(text: string, max = 12): string {
  const seen = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9']+/)) {
    const w = word.replace(/^'+|'+$/g, "");
    if (w.length < 3 || STOP_WORDS.has(w)) continue;
    seen.add(w);
    if (seen.size >= max) break;
  }
  return [...seen].join(" ");
}

export type Hit = { page: number; text: string };
export type Passage = { n: number; page: number; text: string };

const CHAPTER_BOOST = 0.35; // added to a page's rank score when it is in the chapter the reader is in
const MAX_PASSAGE_CHARS = 1800;

// Search hits arrive best first. Pages in the reader's current chapter get a boost, then the best few are kept.
export function pickPassages(hits: Hit[], chapter: { startPage: number; endPage: number } | null, limit = 6): Passage[] {
  return hits
    .map((h, i) => ({ h, score: 1 / (i + 1) + (chapter && h.page >= chapter.startPage && h.page <= chapter.endPage ? CHAPTER_BOOST : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ h }, i) => ({ n: i + 1, page: h.page, text: h.text.slice(0, MAX_PASSAGE_CHARS) }));
}

// For a chapter summary: every page of the range, trimmed evenly so the whole chapter fits in a budget.
// Each passage is numbered by its page, so a bullet can cite "[5]" and mean page 5.
export function summaryPassages(pages: Hit[], maxTotalChars = 24000): Passage[] {
  if (pages.length === 0) return [];
  const each = Math.max(300, Math.min(MAX_PASSAGE_CHARS, Math.floor(maxTotalChars / pages.length)));
  return pages.map((p) => ({ n: p.page, page: p.page, text: p.text.slice(0, each) }));
}

export function passageBlock(passages: Passage[]): string {
  return passages.map((p) => `[${p.n}] (page ${p.page})\n${p.text}`).join("\n\n");
}

// ---- Checking what the AI sends back ----

// `valid` is how many passages were given (numbered 1..n), or the exact list of numbers that were given.
type Valid = number | number[];
const isValid = (n: number, valid: Valid) => (typeof valid === "number" ? Number.isInteger(n) && n >= 1 && n <= valid : valid.includes(n));

export function filterCitations(cited: unknown, valid: Valid): number[] {
  if (!Array.isArray(cited)) return [];
  const out: number[] = [];
  for (const c of cited) {
    const n = typeof c === "number" ? c : Number(c);
    if (isValid(n, valid) && !out.includes(n)) out.push(n);
  }
  return out;
}

// Removes [n] markers that don't point at a passage the AI was given, so no chip leads nowhere.
export function cleanAnswer(answer: string, valid: Valid): string {
  return answer
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (m, group: string) => {
      const keep = group.split(",").map((s) => Number(s.trim())).filter((n) => isValid(n, valid));
      return keep.length ? keep.map((n) => `[${n}]`).join("") : "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?])/g, "$1") // a removed marker shouldn't leave a gap before punctuation
    .trim();
}

export type ChatAnswer = { answer: string; citations: number[] };

export function parseChatAnswer(raw: unknown, valid: Valid): ChatAnswer | null {
  const r = raw as { answer?: unknown; citations?: unknown } | null;
  if (!r || typeof r.answer !== "string" || !r.answer.trim()) return null;
  const answer = cleanAnswer(r.answer.slice(0, 4000), valid);
  const inText = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  return { answer, citations: filterCitations([...inText, ...(Array.isArray(r.citations) ? r.citations : [])], valid) };
}

// ---- Validating a reflection note ----

export type NoteStatus = "supported" | "incorrect" | "not_in_book";
export type NoteCheck = { claim: string; status: NoteStatus; correction?: string; citations: number[] };
export type NoteVerdict = "accurate" | "has_issues" | "cannot_judge";
export type NoteResult = { verdict: NoteVerdict; summary: string; checks: NoteCheck[] };

const STATUSES: NoteStatus[] = ["supported", "incorrect", "not_in_book"];
const MAX_CHECKS = 8;

export function parseNoteResult(raw: unknown, valid: Valid): NoteResult | null {
  const r = raw as { summary?: unknown; checks?: unknown } | null;
  if (!r || !Array.isArray(r.checks)) return null;
  const checks: NoteCheck[] = [];
  for (const c of r.checks.slice(0, MAX_CHECKS)) {
    const item = c as { claim?: unknown; status?: unknown; correction?: unknown; citations?: unknown };
    if (typeof item.claim !== "string" || !item.claim.trim()) continue;
    if (!STATUSES.includes(item.status as NoteStatus)) continue;
    const status = item.status as NoteStatus;
    checks.push({
      claim: item.claim.trim().slice(0, 400),
      status,
      // A correction only makes sense for something that is wrong.
      correction: status === "incorrect" && typeof item.correction === "string" ? cleanAnswer(item.correction.slice(0, 600), valid) : undefined,
      citations: filterCitations(item.citations, valid),
    });
  }
  // The verdict comes from the checks, not from what the AI claims.
  const verdict: NoteVerdict =
    checks.length === 0 ? "cannot_judge" : checks.some((c) => c.status === "incorrect") ? "has_issues" : checks.every((c) => c.status === "supported") ? "accurate" : "has_issues";
  const summary = typeof r.summary === "string" ? cleanAnswer(r.summary.slice(0, 500), valid) : "";
  return { verdict, summary, checks };
}
