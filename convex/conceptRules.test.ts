import { describe, expect, test } from "vitest";
import {
  Answer,
  applyRepair,
  BankQuestion,
  buildSession,
  Candidate,
  cleanCandidate,
  correctIsLongest,
  dueAtOf,
  echoesSource,
  evidenceOf,
  fitPages,
  Idea,
  lengthCue,
  Mode,
  placeOptions,
  quoteOnPage,
  selectQuestions,
  sourceProfile,
  standing,
  statusOf,
  xpForAnswer,
} from "./conceptRules";

const H = 3_600_000;
const D = 24 * H;
const a = (questionId: string, at: number, correct: boolean, confidence: Answer["confidence"] = "sure", mode: Mode = "remember", ideaId = "i1"): Answer => ({ questionId, ideaId, mode, correct, confidence, at });
const statuses = (list: Answer[]) => list.map((_, i) => statusOf(list.slice(0, i + 1)));

describe("status", () => {
  test("spec example: Remember", () => {
    const mon = 9 * H;
    const list = [a("q1", mon, false), a("q2", mon + 120_000, true, "guess"), a("q1", D + 20 * H, true), a("q2", 3 * D + 18 * H, true, "think"), a("q1", 7 * D, false)];
    expect(statuses(list)).toEqual(["needs_practice", "needs_practice", "shaky", "solid", "shaky"]);
  });

  test("spec example: Apply needs different scenarios, spacing and a first-sight pass", () => {
    const ap = (q: string, at: number, ok: boolean, c: Answer["confidence"] = "sure") => a(q, at, ok, c, "apply");
    const list = [ap("a", 9 * H, true), ap("b", 10 * H, true), ap("c", 3 * D, true, "think"), ap("a", 20 * D, false), ap("b", 22 * D, true), ap("c", 24 * D, true)];
    expect(statuses(list)).toEqual(["shaky", "shaky", "solid", "shaky", "shaky", "solid"]);
  });

  test("19.9 hours is not spaced, 20 is", () => {
    expect(statusOf([a("q1", 0, true), a("q2", 19.9 * H, true)])).toBe("shaky");
    expect(statusOf([a("q1", 0, true), a("q2", 20 * H, true)])).toBe("solid");
  });

  test("cramming the same question can't reach Solid", () => {
    expect(statusOf(Array.from({ length: 10 }, (_, i) => a("q1", i * H, true)))).toBe("shaky");
  });

  test("all guesses never become Solid", () => {
    expect(statusOf([a("q1", 0, true, "guess"), a("q2", 2 * D, true, "guess")])).toBe("shaky");
  });

  test("a repeated scenario never counts as transfer", () => {
    const e = evidenceOf([a("s", 0, true, "sure", "apply"), a("s", 15 * D, true, "sure", "apply")]);
    expect(e.map((x) => x.kind)).toEqual(["transfer", "retention"]);
    expect(statusOf([a("s", 0, true, "sure", "apply"), a("s", 15 * D, true, "sure", "apply")])).toBe("shaky");
  });
});

describe("schedule", () => {
  test("passes climb 1, 3, 7, 21 days and a miss resets", () => {
    let list = [a("q", 0, true)];
    expect(dueAtOf(list)).toBe(D);
    list = [...list, a("q", D, true)];
    expect(dueAtOf(list)).toBe(4 * D);
    list = [...list, a("q", 4 * D, true)];
    expect(dueAtOf(list)).toBe(11 * D);
    list = [...list, a("q", 11 * D, true)];
    expect(dueAtOf(list)).toBe(32 * D);
    expect(dueAtOf([...list, a("q", 12 * D, false)])).toBe(13 * D);
  });

  test("same-day practice doesn't advance the date", () => {
    expect(dueAtOf([a("q", 0, true), a("q", H, true)])).toBe(D);
  });
});

const bank = (ideas: string[], modes: Mode[] = ["remember", "understand", "apply", "analyze"]): BankQuestion[] =>
  ideas.flatMap((ideaId) => modes.map((mode) => ({ id: `${ideaId}-${mode}`, ideaId, mode, difficulty: "core" as const })));

describe("session builder", () => {
  test("first session covers every idea, caps per idea and includes higher-order", () => {
    const ideas = ["i1", "i2", "i3", "i4", "i5"];
    const s = buildSession(ideas, bank(ideas), [], 0);
    expect(s).toHaveLength(8);
    const b = bank(ideas);
    const qs = s.map((x) => b.find((q) => q.id === x.questionId)!);
    expect(new Set(qs.map((q) => q.ideaId)).size).toBe(5);
    expect(qs.filter((q) => q.mode === "apply" || q.mode === "analyze").length).toBeGreaterThanOrEqual(2);
    for (const i of ideas) expect(qs.filter((q) => q.ideaId === i).length).toBeLessThanOrEqual(3);
    qs.slice(1).forEach((q, i) => expect(q.ideaId).not.toBe(qs[i].ideaId));
  });

  test("one idea ends early instead of padding", () => {
    expect(buildSession(["i1"], bank(["i1"]), [], 0).length).toBe(3);
  });

  test("a confident error comes back first", () => {
    const b = bank(["i1", "i2"], ["remember"]);
    const answers = [a("i1-remember", 0, false, "think"), a("i2-remember", 1000, false, "sure", "remember", "i2")];
    const s = buildSession(["i1", "i2"], b, answers, 2 * D);
    expect(s[0]).toEqual({ questionId: "i2-remember", reason: "due" });
  });

  test("exhausted bank only repeats when asked", () => {
    const b = bank(["i1"], ["apply"]);
    const answers = [a("i1-apply", 0, true, "sure", "apply")];
    expect(buildSession(["i1"], b, answers, H)).toEqual([]);
    expect(buildSession(["i1"], b, answers, H, { anyway: true })).toEqual([{ questionId: "i1-apply", reason: "repeat" }]);
  });

  test("misses mode returns only the latest misses", () => {
    const b = bank(["i1"], ["remember", "understand"]);
    const answers = [a("i1-remember", 0, false), a("i1-remember", H, true), a("i1-understand", 2 * H, false, "sure", "understand")];
    expect(buildSession(["i1"], b, answers, 3 * H, { misses: true }).map((x) => x.questionId)).toEqual(["i1-understand"]);
  });

  test("a removed question stops counting", () => {
    const b = bank(["i1"], ["remember"]);
    const cells = standing(["i1"], [], [a("i1-remember", 0, false)], D);
    expect(cells.every((c) => c.status === "not_checked")).toBe(true);
    expect(standing(["i1"], b, [a("i1-remember", 0, false)], D)[0].status).toBe("needs_practice");
  });

  test("one miss doesn't change other cells", () => {
    const b = bank(["i1"], ["remember", "understand"]);
    const list = [a("i1-understand", 0, true, "sure", "understand"), a("i1-remember", H, false)];
    const cells = standing(["i1"], b, list, 2 * H);
    expect(cells.find((c) => c.mode === "understand")!.status).toBe("shaky");
    expect(cells.find((c) => c.mode === "remember")!.status).toBe("needs_practice");
  });
});

test("XP is capped per idea and ignores confidence", () => {
  expect(xpForAnswer({ firstRight: true, becameSolid: true, earnedOnIdea: 0 })).toBe(7);
  expect(xpForAnswer({ firstRight: true, becameSolid: false, earnedOnIdea: 39 })).toBe(1);
  expect(xpForAnswer({ firstRight: false, becameSolid: false, earnedOnIdea: 0 })).toBe(0);
});

const ideas: Idea[] = [{ id: "i1", name: "Load balancing", objective: "The reader can route traffic", page: 3 }];
const pages = [{ page: 3, text: "A load balancer evenly distributes incoming traffic among web servers in a pool. function route(x) { return x + 1; } Figure 1-4 shows it." }];
const raw = (extra: Record<string, unknown> = {}) => ({
  ideaId: "i1",
  mode: "understand",
  difficulty: "stretch",
  question: "Why does a team add this component?",
  correct: "It spreads requests across servers",
  wrong: [
    { option: "It stores sessions on each client", why: "a" },
    { option: "It compresses replies before sending", why: "b" },
    { option: "It retries failed database writes", why: "c" },
  ],
  explanation: "It shares traffic.",
  page: 3,
  excerpt: "evenly distributes incoming traffic among web servers",
  ...extra,
});

describe("question checks", () => {
  test("accepts a good question", () => expect(cleanCandidate(raw(), ideas, pages).ok).toBe(true));
  test("quote must be on the cited page, ignoring punctuation", () => {
    expect(quoteOnPage("Evenly distributes, incoming traffic among", pages[0].text)).toBe(true);
    expect(cleanCandidate(raw({ excerpt: "this sentence is nowhere in the source" }), ideas, pages)).toEqual({ ok: false, why: "quote" });
  });
  test("blocks negative stems, figure references and catch-alls", () => {
    expect(cleanCandidate(raw({ question: "Which of these is not a benefit?" }), ideas, pages)).toEqual({ ok: false, why: "stem" });
    expect(cleanCandidate(raw({ question: "What does Figure 1-4 show?" }), ideas, pages)).toEqual({ ok: false, why: "stem" });
    expect(cleanCandidate(raw({ correct: "All of the above" }), ideas, pages)).toEqual({ ok: false, why: "options" });
  });
  test("code must exist on the page", () => {
    const ok = cleanCandidate(raw({ code: "function route(x) { return x + 1; }" }), ideas, pages);
    expect(ok.ok && ok.candidate.code).toBeTruthy();
    expect(cleanCandidate(raw({ code: "function invented() {}" }), ideas, pages)).toEqual({ ok: false, why: "quote" });
  });
  test("an Apply answer can't copy the source", () => {
    expect(echoesSource({ mode: "apply", correct: "evenly distributes incoming traffic among servers", excerpt: "evenly distributes incoming traffic among web servers" })).toBe(true);
    expect(echoesSource({ mode: "remember", correct: "evenly distributes incoming traffic among servers", excerpt: "evenly distributes incoming traffic among web servers" })).toBe(false);
  });
  test("length cue at 1.15 times the longest wrong option", () => {
    const wrong = [{ option: "x".repeat(100), why: "" }, { option: "y", why: "" }, { option: "z", why: "" }];
    expect(lengthCue({ correct: "c".repeat(115), wrong })).toBe(false);
    expect(lengthCue({ correct: "c".repeat(116), wrong })).toBe(true);
  });
  test("repair never changes the correct answer", () => {
    const c = (cleanCandidate(raw(), ideas, pages) as { candidate: Candidate }).candidate;
    const fixed = applyRepair(c, [{ option: "New one" }, { option: "New two" }, { option: "New three" }]);
    expect(fixed.correct).toBe(c.correct);
    expect(fixed.wrong[0].option).toBe("New one");
    expect(applyRepair(c, [{ option: c.correct }, { option: "b" }, { option: "c" }])).toBe(c);
  });
  test("options keep one key at a stable position", () => {
    const c = (cleanCandidate(raw(), ideas, pages) as { candidate: Candidate }).candidate;
    const p = placeOptions(c);
    expect(p.options[p.answer]).toBe(c.correct);
    expect(p.whyWrong[p.answer]).toBe("");
    expect(placeOptions(c)).toEqual(p);
  });
});

describe("selection", () => {
  const cand = (n: number, ideaId: string, difficulty: Candidate["difficulty"], longest: boolean, guessable = false): Candidate => ({
    ideaId,
    mode: (["remember", "understand", "apply"] as Mode[])[n % 3],
    difficulty,
    question: `q${n}`,
    correct: longest ? "c".repeat(21) : "c".repeat(10),
    wrong: [{ option: "w".repeat(20), why: "" }, { option: "x", why: "" }, { option: "y", why: "" }],
    explanation: "e",
    page: 1,
    excerpt: "e",
    guessable,
  });

  test("meets the mix, spreads ideas and limits longest-correct to 40%", () => {
    const pool = Array.from({ length: 15 }, (_, n) => cand(n, `i${n % 5}`, (["core", "stretch", "hard"] as const)[n % 3], n % 4 === 0));
    const out = selectQuestions(pool, 12);
    expect(out).toHaveLength(12);
    expect(new Set(out.map((c) => c.ideaId)).size).toBe(5);
    expect(out.filter(correctIsLongest).length).toBeLessThanOrEqual(4);
    expect(out.filter((c) => c.difficulty === "hard").length).toBeGreaterThanOrEqual(3);
  });

  test("drops an obvious length cue", () => {
    const bad = { ...cand(1, "i1", "core", false), correct: "c".repeat(40) };
    expect(selectQuestions([bad, cand(2, "i1", "core", false)], 12)).toHaveLength(1);
  });

  test("prefers a question the blind check couldn't solve", () => {
    const easy = cand(1, "i1", "hard", false, true);
    const real = cand(4, "i1", "hard", false, false);
    expect(selectQuestions([easy, real], 1)[0]).toBe(real);
  });
});

test("long chapters keep every page, under the limit", () => {
  const out = fitPages(Array.from({ length: 10 }, (_, i) => ({ page: i + 1, text: "x".repeat(1000) })), 2000);
  expect(out).toHaveLength(10);
  expect(out.reduce((n, p) => n + p.text.length, 0)).toBeLessThanOrEqual(2000);
});

test("source profile", () => {
  expect(sourceProfile("powerpoint", [])).toBe("slides");
  expect(sourceProfile("article", [])).toBe("article");
  expect(sourceProfile("pdf", [{ page: 1, text: "Figure 1 shows it.\nTable 2 too.\nfunction go() {" }])).toBe("technical");
  expect(sourceProfile("pdf", [{ page: 1, text: "It was a quiet morning when she left." }])).toBe("prose");
});
