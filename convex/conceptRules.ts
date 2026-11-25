// Concept check rules (tasks/feature-5-concept-check, ADR 019). Pure code: evidence, status, scheduling, the session
// builder, XP, and the checks every AI-written question must pass. All numbers are hypotheses and live here.

export const MODES = ["remember", "understand", "apply", "analyze"] as const;
export type Mode = (typeof MODES)[number];
export const DIFFICULTIES = ["core", "stretch", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Confidence = "sure" | "think" | "guess";
export type Status = "solid" | "shaky" | "needs_practice" | "not_checked";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const RULES = {
  spacedMs: 20 * HOUR,
  repeatScenarioMs: 14 * DAY,
  intervalsDays: [1, 3, 7, 21],
  intervalGrowth: 2.5,
  sessionSize: 8,
  maxPerIdea: 3,
  minHigherOrder: 2,
  xpFirstRight: 2,
  xpFirstSolid: 5,
  xpMaxPerIdea: 40,
  maxLengthRatio: 1.15,
  maxLongestShare: 0.4,
  starterServed: 12,
} as const;

export type Answer = { questionId: string; ideaId: string; mode: Mode; correct: boolean; confidence: Confidence; at: number };
export type BankQuestion = { id: string; ideaId: string; mode: Mode; difficulty: Difficulty };

const higherOrder = (m: Mode) => m === "apply" || m === "analyze";
export const cellKey = (ideaId: string, mode: Mode) => `${ideaId}:${mode}`;
const byTime = (a: Answer, b: Answer) => a.at - b.at;

// ---- Evidence and status ----

export type Evidence = Answer & { kind: "retention" | "transfer"; result: "pass" | "weak" | "miss"; firstSight: boolean };

// Which answers count. First sight always does; a repeat counts only after enough time has passed.
export function evidenceOf(answers: Answer[]): Evidence[] {
  const lastSeen = new Map<string, number>();
  const out: Evidence[] = [];
  for (const a of [...answers].sort(byTime)) {
    const seen = lastSeen.get(a.questionId);
    const firstSight = seen === undefined;
    const gap = higherOrder(a.mode) ? RULES.repeatScenarioMs : RULES.spacedMs;
    if (firstSight || a.at - seen >= gap) {
      const result = !a.correct ? "miss" : a.confidence === "guess" ? "weak" : "pass";
      out.push({ ...a, kind: firstSight && higherOrder(a.mode) ? "transfer" : "retention", result, firstSight });
    }
    lastSeen.set(a.questionId, a.at);
  }
  return out;
}

export function statusOf(answers: Answer[]): Status {
  const evidence = evidenceOf(answers);
  if (evidence.length === 0) return "not_checked";
  const lastMiss = evidence.map((e) => e.result).lastIndexOf("miss");
  const passes = evidence.slice(lastMiss + 1).filter((e) => e.result === "pass");
  if (passes.length >= 2 && passes[passes.length - 1].at - passes[0].at >= RULES.spacedMs) {
    const mode = evidence[0].mode;
    const scenarios = new Set(passes.map((p) => p.questionId)).size;
    const firstSightPass = evidence.some((e) => e.result === "pass" && e.firstSight);
    if (!higherOrder(mode) || (scenarios >= 2 && firstSightPass)) return "solid";
  }
  const firm = evidence.filter((e) => e.result !== "weak");
  const latest = firm[firm.length - 1];
  const before = firm[firm.length - 2];
  if (latest?.result === "miss" && before?.result !== "pass") return "needs_practice";
  return "shaky";
}

// ---- Scheduling ----

export function intervalDays(step: number): number {
  const list = RULES.intervalsDays;
  if (step < list.length) return list[step];
  return Math.round(list[list.length - 1] * RULES.intervalGrowth ** (step - list.length + 1));
}

// When this idea + mode should come back. A pass under 20 hours after the last advance doesn't move it.
export function dueAtOf(answers: Answer[]): number | null {
  let step = -1;
  let due: number | null = null;
  let advanced: number | null = null;
  for (const a of [...answers].sort(byTime)) {
    if (!a.correct) {
      step = 0;
      due = a.at + DAY;
      advanced = a.at;
    } else if (a.confidence === "guess") {
      due = Math.min(due ?? Infinity, a.at + DAY);
    } else if (advanced === null || a.at - advanced >= RULES.spacedMs) {
      step += 1;
      due = a.at + intervalDays(step) * DAY;
      advanced = a.at;
    }
  }
  return due;
}

// A question can be asked for evidence if it's new, or enough time has passed since it was seen.
function eligible(q: BankQuestion, lastSeen: Map<string, number>, now: number) {
  const seen = lastSeen.get(q.id);
  return seen === undefined || now - seen >= (higherOrder(q.mode) ? RULES.repeatScenarioMs : RULES.spacedMs);
}

// ---- Where the reader stands ----

export type Cell = { ideaId: string; mode: Mode; status: Status; right: number; total: number; lastAt: number | null; dueAt: number | null; available: number };

export function standing(ideaIds: string[], bank: BankQuestion[], allAnswers: Answer[], now: number): Cell[] {
  const active = new Set(bank.map((q) => q.id));
  const answers = allAnswers.filter((a) => active.has(a.questionId));
  const lastSeen = lastSeenOf(answers);
  return ideaIds.flatMap((ideaId) =>
    MODES.map((mode) => {
      const mine = answers.filter((a) => a.ideaId === ideaId && a.mode === mode).sort(byTime);
      const questions = bank.filter((q) => q.ideaId === ideaId && q.mode === mode);
      const recent = mine.slice(-3);
      const due = dueAtOf(mine);
      return {
        ideaId,
        mode,
        status: statusOf(mine),
        right: recent.filter((a) => a.correct).length,
        total: recent.length,
        lastAt: mine.length ? mine[mine.length - 1].at : null,
        // A due cell with nothing eligible to ask isn't shown as due.
        dueAt: due !== null && questions.some((q) => eligible(q, lastSeen, Math.max(now, due))) ? due : null,
        available: questions.length,
      };
    })
  );
}

function lastSeenOf(answers: Answer[]) {
  const seen = new Map<string, number>();
  for (const a of [...answers].sort(byTime)) seen.set(a.questionId, a.at);
  return seen;
}

export function nextCheckAt(cells: Cell[]): number | null {
  const dues = cells.flatMap((c) => (c.dueAt === null ? [] : [c.dueAt]));
  return dues.length ? Math.min(...dues) : null;
}

// ---- Session builder ----

export type SessionItem = { questionId: string; reason: "due" | "new" | "fresh" | "maintain" | "repeat" | "miss" };

const rank = (q: BankQuestion) => MODES.indexOf(q.mode) * 3 + DIFFICULTIES.indexOf(q.difficulty);

export function buildSession(ideaIds: string[], bank: BankQuestion[], allAnswers: Answer[], now: number, opts: { anyway?: boolean; misses?: boolean } = {}): SessionItem[] {
  const active = new Set(bank.map((q) => q.id));
  const answers = allAnswers.filter((a) => active.has(a.questionId)).sort(byTime);
  const lastSeen = lastSeenOf(answers);
  const picked: (SessionItem & { q: BankQuestion })[] = [];
  const perIdea = (id: string) => picked.filter((p) => p.q.ideaId === id).length;
  const take = (q: BankQuestion | undefined, reason: SessionItem["reason"]) => {
    if (!q || picked.length >= RULES.sessionSize || perIdea(q.ideaId) >= RULES.maxPerIdea || picked.some((p) => p.questionId === q.id)) return false;
    picked.push({ questionId: q.id, reason, q });
    return true;
  };
  const unseen = (q: BankQuestion) => !lastSeen.has(q.id);
  const oldestFirst = (a: BankQuestion, b: BankQuestion) => (lastSeen.get(a.id) ?? -1) - (lastSeen.get(b.id) ?? -1) || rank(a) - rank(b);
  const inCell = (ideaId: string, mode: Mode) => bank.filter((q) => q.ideaId === ideaId && q.mode === mode);

  if (opts.misses) {
    const latest = new Map(answers.map((a) => [a.questionId, a]));
    const missed = bank.filter((q) => latest.get(q.id)?.correct === false).sort((a, b) => Number(latest.get(b.id)!.confidence === "sure") - Number(latest.get(a.id)!.confidence === "sure"));
    for (const q of missed) take(q, "miss");
    return order(picked);
  }

  // 1. Due cells, confident errors first.
  const cells = standing(ideaIds, bank, answers, now);
  const lastIn = (c: Cell) => answers.filter((a) => a.ideaId === c.ideaId && a.mode === c.mode).at(-1);
  const confidentError = (c: Cell) => (lastIn(c)?.correct === false && lastIn(c)?.confidence === "sure" ? 0 : 1);
  const due = cells.filter((c) => c.dueAt !== null && c.dueAt <= now).sort((a, b) => confidentError(a) - confidentError(b) || a.dueAt! - b.dueAt!);
  for (const c of due) take(inCell(c.ideaId, c.mode).filter((q) => eligible(q, lastSeen, now)).sort(oldestFirst)[0], "due");

  // 2. One question for each idea not yet checked, rotating modes.
  ideaIds.forEach((id, i) => {
    if (answers.some((a) => a.ideaId === id) || picked.some((p) => p.q.ideaId === id)) return;
    const rotated = [...MODES.slice(i % MODES.length), ...MODES.slice(0, i % MODES.length)];
    for (const m of rotated) if (take(inCell(id, m).filter(unseen).sort(oldestFirst)[0], "new")) break;
  });

  // 3. Fresh scenarios, at least two when available.
  const fresh = bank.filter((q) => higherOrder(q.mode) && unseen(q)).sort((a, b) => perIdea(a.ideaId) - perIdea(b.ideaId) || rank(a) - rank(b));
  for (const q of fresh) {
    if (picked.filter((p) => higherOrder(p.q.mode)).length >= RULES.minHigherOrder) break;
    take(q, "fresh");
  }

  // 4. Fill: anything unseen, easier first and spread across ideas.
  for (const q of bank.filter(unseen).sort((a, b) => perIdea(a.ideaId) - perIdea(b.ideaId) || rank(a) - rank(b))) take(q, higherOrder(q.mode) ? "fresh" : "new");

  // 5. Maintain the oldest Solid cells.
  const solid = cells.filter((c) => c.status === "solid").sort((a, b) => (a.lastAt ?? 0) - (b.lastAt ?? 0));
  for (const c of solid) take(inCell(c.ideaId, c.mode).filter((q) => eligible(q, lastSeen, now)).sort(oldestFirst)[0], "maintain");

  // 6. Repeats only when the reader asks to practice anyway.
  if (opts.anyway) for (const q of [...bank].sort(oldestFirst)) take(q, "repeat");
  return order(picked);
}

// Due first, then easier to harder, avoiding the same idea twice in a row.
function order(items: (SessionItem & { q: BankQuestion })[]): SessionItem[] {
  const pool = [...items].sort((a, b) => Number(b.reason === "due" || b.reason === "miss") - Number(a.reason === "due" || a.reason === "miss") || rank(a.q) - rank(b.q));
  const out: typeof pool = [];
  while (pool.length) {
    const prev = out[out.length - 1]?.q.ideaId;
    const i = pool.findIndex((p) => p.q.ideaId !== prev);
    out.push(pool.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out.map(({ questionId, reason }) => ({ questionId, reason }));
}

// ---- XP ----

// +2 the first time a question is right, +5 the first time a cell is Solid, at most 40 per idea. Confidence never counts.
export function xpForAnswer(args: { firstRight: boolean; becameSolid: boolean; earnedOnIdea: number }): number {
  const raw = (args.firstRight ? RULES.xpFirstRight : 0) + (args.becameSolid ? RULES.xpFirstSolid : 0);
  return Math.max(0, Math.min(raw, RULES.xpMaxPerIdea - args.earnedOnIdea));
}

// ---- Checking what the AI wrote ----

export type Page = { page: number; text: string };
export type Idea = { id: string; name: string; objective: string; page: number };
export type Candidate = {
  ideaId: string;
  mode: Mode;
  difficulty: Difficulty;
  question: string;
  code?: string;
  correct: string;
  wrong: { option: string; why: string }[];
  explanation: string;
  page: number;
  excerpt: string;
  figure?: string;
  guessable?: boolean;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const quoteOnPage = (quote: string, page: string) => {
  const q = normalizeText(quote);
  return q.split(" ").length >= 5 && normalizeText(page).includes(q);
};

const STOP = new Set("a an and are as at be but by for from has have in is it its of on or that the their this to was were will with you your".split(" "));
const contentWords = (s: string) => normalizeText(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));

// The correct option is noticeably longer than every wrong one: a cue that needs no reading.
export const lengthCue = (c: Pick<Candidate, "correct" | "wrong">) => c.correct.length > Math.round(Math.max(...c.wrong.map((w) => w.option.length)) * RULES.maxLengthRatio * 1000) / 1000;
export const correctIsLongest = (c: Pick<Candidate, "correct" | "wrong">) => c.correct.length > Math.max(...c.wrong.map((w) => w.option.length));

// An Apply or Analyze answer that mostly copies the source can be found by matching words.
export function echoesSource(c: Pick<Candidate, "mode" | "correct" | "excerpt">) {
  if (!higherOrder(c.mode)) return false;
  const words = contentWords(c.correct);
  if (words.length < 4) return false;
  const source = new Set(contentWords(c.excerpt));
  return words.filter((w) => source.has(w)).length / words.length >= 0.75;
}

const giveaway = (c: Candidate, idea: Idea) => {
  const name = normalizeText(idea.name);
  return name.length > 3 && normalizeText(c.correct).includes(name) && !c.wrong.some((w) => normalizeText(w.option).includes(name));
};

const NEGATIVE = /\b(not|except|least|false)\b.{0,30}\?$|\bwhich .{0,30}\b(is|are) not\b/i;
const VISUAL_REF = /\b(figure|fig\.|table|diagram|slide|chart)\s*\d/i;
const CATCH_ALL = /\b(all|none|both|neither) of (the|these)\b|\bboth [a-d] and [a-d]\b/i;

export function cleanIdeas(raw: unknown, validPages: number[]): Idea[] {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Idea[] = [];
  for (const r of list.slice(0, 5) as Record<string, unknown>[]) {
    const id = str(r?.id, 12);
    const name = str(r?.name, 60);
    const objective = str(r?.objective, 200);
    const page = validPages.includes(r?.page as number) ? (r.page as number) : validPages[0];
    if (!id || !name || !objective || seen.has(id) || /^(introduction|overview|key points|summary)$/i.test(name)) continue;
    seen.add(id);
    out.push({ id, name, objective, page });
  }
  return out;
}

export type Rejection = "idea" | "mode" | "fields" | "wrong_count" | "quote" | "stem" | "options" | "echo" | "giveaway";

// Parses one question. `length` isn't a rejection here: those questions get one repair try.
export function cleanCandidate(raw: unknown, ideas: Idea[], pages: Page[]): { ok: true; candidate: Candidate } | { ok: false; why: Rejection } {
  const r = raw as Record<string, unknown>;
  const idea = ideas.find((i) => i.id === r?.ideaId);
  const mode = r?.mode as Mode;
  const difficulty = DIFFICULTIES.includes(r?.difficulty as Difficulty) ? (r.difficulty as Difficulty) : "stretch";
  const question = str(r?.question, 500);
  const correct = str(r?.correct, 240);
  const explanation = str(r?.explanation, 400);
  const excerpt = str(r?.excerpt, 320);
  const wrongRaw = Array.isArray(r?.wrong) ? (r.wrong as Record<string, unknown>[]) : [];
  const wrong = wrongRaw.map((w) => ({ option: str(w?.option, 240), why: str(w?.why, 220) }));
  if (!idea) return { ok: false, why: "idea" };
  if (!MODES.includes(mode)) return { ok: false, why: "mode" };
  if (wrong.length !== 3) return { ok: false, why: "wrong_count" };
  if (!question || !correct || !explanation || wrong.some((w) => !w.option || !w.why)) return { ok: false, why: "fields" };
  const page = pages.find((p) => p.page === r.page);
  if (!page || !quoteOnPage(excerpt, page.text)) return { ok: false, why: "quote" };
  if (NEGATIVE.test(question) || VISUAL_REF.test(question)) return { ok: false, why: "stem" };
  const options = [correct, ...wrong.map((w) => w.option)];
  if (new Set(options.map(normalizeText)).size !== 4 || options.some((o) => CATCH_ALL.test(o))) return { ok: false, why: "options" };
  const rawCode = str(r?.code, 900);
  const code = rawCode && normalizeText(page.text).includes(normalizeText(rawCode)) ? rawCode : undefined;
  if (rawCode && !code) return { ok: false, why: "quote" }; // a question built on code the source doesn't contain
  const label = str(r?.figure, 24);
  const figure = /^(figure|fig\.?|table)\s*[\d.-]+$/i.test(label) && normalizeText(page.text).includes(normalizeText(label)) ? label : undefined;
  const candidate: Candidate = { ideaId: idea.id, mode, difficulty, question, ...(code ? { code } : {}), correct, wrong, explanation, page: page.page, excerpt, ...(figure ? { figure } : {}) };
  if (echoesSource(candidate)) return { ok: false, why: "echo" };
  if (giveaway(candidate, idea)) return { ok: false, why: "giveaway" };
  return { ok: true, candidate };
}

// Replaces only wrong options, never the correct answer, and keeps the old ones if the repair isn't usable.
export function applyRepair(c: Candidate, wrong: unknown): Candidate {
  if (!Array.isArray(wrong) || wrong.length !== 3) return c;
  const next = wrong.map((w, i) => ({ option: str((w as { option?: unknown })?.option, 240), why: str((w as { why?: unknown })?.why, 220) || c.wrong[i].why }));
  const options = [c.correct, ...next.map((w) => w.option)];
  if (next.some((w) => !w.option) || new Set(options.map(normalizeText)).size !== 4 || options.some((o) => CATCH_ALL.test(o))) return c;
  return { ...c, wrong: next };
}

// Chooses what readers see: spread across ideas and the difficulty mix, with the correct answer rarely the longest.
export function selectQuestions(candidates: Candidate[], target: number, mix: Record<Difficulty, number> = { core: 4, stretch: 5, hard: 3 }): Candidate[] {
  const pool = candidates.filter((c) => !lengthCue(c));
  const total = mix.core + mix.stretch + mix.hard;
  const quota = (d: Difficulty) => Math.round((mix[d] / total) * target);
  const picked: Candidate[] = [];
  const count = (f: (c: Candidate) => boolean) => picked.filter(f).length;
  const longestCap = Math.floor(target * RULES.maxLongestShare);
  while (picked.length < target) {
    let best: Candidate | null = null;
    let bestScore = -Infinity;
    for (const c of pool) {
      if (picked.includes(c) || (correctIsLongest(c) && count(correctIsLongest) >= longestCap)) continue;
      const score =
        -3 * count((p) => p.ideaId === c.ideaId) -
        count((p) => p.ideaId === c.ideaId && p.mode === c.mode) * 4 +
        (count((p) => p.difficulty === c.difficulty) < quota(c.difficulty) ? 4 : 0) -
        (c.guessable && c.difficulty !== "core" ? 2 : 0);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (!best) break;
    picked.push(best);
  }
  // A short batch can still break the share rule: drop extras rather than serve a pattern.
  while (picked.length > 1 && count(correctIsLongest) / picked.length > RULES.maxLongestShare) picked.splice(picked.findLastIndex(correctIsLongest), 1);
  return picked;
}

// Fits a chapter under the size limit by giving each page a fair share, so late pages aren't silently dropped.
export function fitPages(pages: Page[], maxChars: number): Page[] {
  const withText = pages.filter((p) => p.text.trim());
  if (withText.length === 0) return [];
  const share = Math.floor(maxChars / withText.length);
  return withText.map((p) => ({ page: p.page, text: p.text.slice(0, share) }));
}

export type SourceProfile = "technical" | "slides" | "article" | "prose";

export function sourceProfile(sourceType: string, pages: Page[]): SourceProfile {
  if (sourceType === "powerpoint") return "slides";
  if (sourceType === "article") return "article";
  const text = pages.map((p) => p.text).join("\n");
  const signals = (text.match(/\b(figure|table)\s+\d|[{};]\s*$|\bfunction\b|\bclass\s+\w+|\bdef\s+\w+|=>/gim) ?? []).length;
  return signals >= Math.max(3, pages.length / 2) ? "technical" : "prose";
}

// Puts the correct answer at a position that doesn't depend on the model. Options never change after saving.
export function placeOptions(c: Pick<Candidate, "question" | "correct" | "wrong">) {
  let hash = 0;
  for (const ch of c.question) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const answer = Math.abs(hash) % 4;
  const wrong = c.wrong.map((w) => w);
  const options: string[] = [];
  const whyWrong: string[] = [];
  for (let i = 0; i < 4; i++) {
    if (i === answer) {
      options.push(c.correct);
      whyWrong.push("");
    } else {
      const w = wrong.shift()!;
      options.push(w.option);
      whyWrong.push(w.why);
    }
  }
  return { options, whyWrong, answer };
}

// ---- Concept map links (Part 7) ----
// Each link is a typed property between two ideas. The types come from standard vocabularies, so the model can't
// invent vague ones: RDFS/SKOS for hierarchy and association, the OBO Relation Ontology and BFO for parts, causes,
// dependencies and order.
export const RELATIONS = {
  is_a: { label: "is a kind of", source: "RDFS subClassOf / SKOS broader" },
  part_of: { label: "is part of", source: "OBO RO part_of (BFO_0000050)" },
  causes: { label: "causes", source: "OBO RO causally upstream of (RO_0002411)" },
  enables: { label: "makes possible", source: "OBO RO enables" },
  requires: { label: "depends on", source: "OBO RO has prerequisite" },
  precedes: { label: "comes before", source: "BFO precedes (BFO_0000063)" },
  contrasts: { label: "contrasts with", source: "SKOS related, narrowed to opposition" },
} as const;
export type Relation = keyof typeof RELATIONS;
export type Link = { from: string; to: string; type: Relation; note: string };
export const MAX_LINKS = 8;

// Keeps only links between known ideas, with a known type, no self-links and no repeats (either direction).
export function cleanLinks(raw: unknown, ideaIds: string[]): Link[] {
  const list = (raw as { links?: unknown })?.links;
  if (!Array.isArray(list)) return [];
  const ids = new Set(ideaIds);
  const seen = new Set<string>();
  const out: Link[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const from = str(r?.from, 12);
    const to = str(r?.to, 12);
    const type = r?.type as Relation;
    if (!ids.has(from) || !ids.has(to) || from === to || !Object.hasOwn(RELATIONS, type)) continue;
    const pair = [from, to].sort().join("|");
    if (seen.has(pair)) continue;
    seen.add(pair);
    out.push({ from, to, type, note: str(r?.note, 160) });
    if (out.length === MAX_LINKS) break;
  }
  return out;
}

// ---- Over time ----
// One point per finished session: how many ideas were solid at each level once it ended, and what it asked.
export type HistoryPoint = { at: number; solid: Record<Mode, number>; asked: Record<Mode, number>; right: number; total: number };

export function sessionHistory(ideaIds: string[], bank: BankQuestion[], answers: (Answer & { sessionId: string })[], sessions: { id: string; endedAt: number }[]): HistoryPoint[] {
  const zero = () => Object.fromEntries(MODES.map((m) => [m, 0])) as Record<Mode, number>;
  return [...sessions]
    .sort((a, b) => a.endedAt - b.endedAt)
    .map((s) => {
      const cells = standing(ideaIds, bank, answers.filter((a) => a.at <= s.endedAt), s.endedAt);
      const solid = zero();
      for (const c of cells) if (c.status === "solid") solid[c.mode]++;
      const mine = answers.filter((a) => a.sessionId === s.id);
      const asked = zero();
      for (const a of mine) asked[a.mode]++;
      return { at: s.endedAt, solid, asked, right: mine.filter((a) => a.correct).length, total: mine.length };
    })
    .filter((p) => p.total > 0);
}
