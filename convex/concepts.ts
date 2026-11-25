import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { BLIND_PROMPT, generationPrompt, linksPrompt, PROMPT_VERSION, REPAIR_PROMPT } from "./conceptPrompts";
import { chapterRanges } from "./chapters";
import {
  Answer,
  applyRepair,
  BankQuestion,
  buildSession,
  Candidate,
  cellKey,
  cleanCandidate,
  cleanIdeas,
  cleanLinks,
  correctIsLongest,
  fitPages,
  Idea,
  nextCheckAt,
  Page,
  placeOptions,
  RELATIONS,
  RULES,
  selectQuestions,
  sessionHistory,
  sourceProfile,
  standing,
  statusOf,
  xpForAnswer,
} from "./conceptRules";
import { getOwnDocument, requireUser } from "./helpers";
import { askConceptJson } from "./llm";
import { MAX_SAVED_PER_DOCUMENT } from "./notebookRules";
import { addXp } from "./xp";

const MAX_CHAPTER_CHARS = 24000;
const MAX_BATCHES = 3;
const MAX_FAILS_PER_DAY = 2;
const LOCK_MS = 2 * 60_000;
const MAX_LINK_TRIES = 2;
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

const hashText = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
};

const checkFor = (ctx: QueryCtx, documentId: Id<"documents">, chapterKey: string) =>
  ctx.db.query("conceptChecks").withIndex("by_document_chapter", (q) => q.eq("documentId", documentId).eq("chapterKey", chapterKey)).first();
const bankOf = (ctx: QueryCtx, checkId: Id<"conceptChecks">) => ctx.db.query("conceptQuestions").withIndex("by_check_mode", (q) => q.eq("checkId", checkId)).collect();
const answersOf = (ctx: QueryCtx, checkId: Id<"conceptChecks">) => ctx.db.query("conceptAnswers").withIndex("by_check_at", (q) => q.eq("checkId", checkId)).collect();

export const toBank = (rows: Doc<"conceptQuestions">[]): BankQuestion[] => rows.filter((q) => q.active).map((q) => ({ id: q._id, ideaId: q.ideaId, mode: q.mode, difficulty: q.difficulty }));
export const toAnswer = (a: Doc<"conceptAnswers">): Answer => ({ questionId: a.questionId, ideaId: a.ideaId, mode: a.mode, correct: a.correct, confidence: a.confidence, at: a.at });

async function ownCheck(ctx: QueryCtx, userId: Id<"users">, checkId: Id<"conceptChecks">) {
  const c = await ctx.db.get(checkId);
  return c && c.userId === userId ? c : null;
}
async function ownSession(ctx: QueryCtx, userId: Id<"users">, sessionId: Id<"conceptSessions">) {
  const s = await ctx.db.get(sessionId);
  return s && s.userId === userId ? s : null;
}
const answerFor = (ctx: QueryCtx, sessionId: Id<"conceptSessions">, questionId: Id<"conceptQuestions">) =>
  ctx.db.query("conceptAnswers").withIndex("by_session_question", (q) => q.eq("sessionId", sessionId).eq("questionId", questionId)).first();

function feedbackOf(q: Doc<"conceptQuestions">, a: Doc<"conceptAnswers">, ideaName: string) {
  return {
    correct: a.correct,
    chosen: a.option,
    answer: q.answer,
    confidence: a.confidence,
    ideaName,
    explanation: q.explanation,
    whyWrong: a.correct ? "" : (q.whyWrong[a.option] ?? ""),
    page: q.page,
    excerpt: q.excerpt,
    figure: q.figure ?? null,
  };
}

// ---- What the browser reads ----

export const get = query({
  args: { documentId: v.id("documents"), chapterKey: v.string() },
  handler: async (ctx, { documentId, chapterKey }) => {
    const userId = await requireUser(ctx);
    if (!(await getOwnDocument(ctx, userId, documentId))) return null;
    const check = await checkFor(ctx, documentId, chapterKey);
    if (!check) return null;
    const now = Date.now();
    const rows = await bankOf(ctx, check._id);
    const bank = toBank(rows);
    const active = new Set(bank.map((q) => q.id));
    const answers = (await answersOf(ctx, check._id)).filter((a) => active.has(a.questionId));
    const cells = standing(check.ideas.map((i) => i.id), bank, answers.map(toAnswer), now);
    const open = await ctx.db.query("conceptSessions").withIndex("by_check_finished", (q) => q.eq("checkId", check._id).eq("finished", false)).first();
    const latest = new Map(answers.map((a) => [a.questionId as string, a]));
    const sure = answers.filter((a) => a.confidence === "sure");
    const nextIds = buildSession(check.ideas.map((i) => i.id), bank, answers.map(toAnswer), now);
    const locked = !!check.generatingBatch && now - (check.generatingAt ?? 0) < LOCK_MS;
    return {
      checkId: check._id,
      ideas: check.ideas,
      cells,
      coverage: check.coverage,
      batchesDone: check.batchesDone,
      canDeepen: check.batchesDone > 0 && check.batchesDone < MAX_BATCHES,
      generatingStage: locked ? (check.generatingStage ?? "Starting") : null,
      openSessionId: open?._id ?? null,
      nextCount: nextIds.length,
      dueNow: cells.filter((c) => c.dueAt !== null && c.dueAt <= now).length,
      missCount: [...latest.values()].filter((a) => !a.correct).length,
      nextCheckAt: nextCheckAt(cells),
      answered: answers.length,
      sureRight: sure.filter((a) => a.correct).length,
      sureTotal: sure.length,
      confidence: (["sure", "think", "guess"] as const).map((level) => {
        const mine = answers.filter((a) => a.confidence === level);
        return { level, right: mine.filter((a) => a.correct).length, total: mine.length };
      }),
      bankSize: bank.length,
      links: check.links ?? null,
      canMapLinks: !check.links && (check.linkTries ?? 0) < MAX_LINK_TRIES,
      history: await historyOf(ctx, check._id, check.ideas.map((i) => i.id), bank, answers),
    };
  },
});

// One point per finished session, ended at its last answer.
async function historyOf(ctx: QueryCtx, checkId: Id<"conceptChecks">, ideaIds: string[], bank: BankQuestion[], answers: Doc<"conceptAnswers">[]) {
  const done = await ctx.db.query("conceptSessions").withIndex("by_check_finished", (q) => q.eq("checkId", checkId).eq("finished", true)).collect();
  const ended = done.flatMap((s) => {
    const at = answers.filter((a) => a.sessionId === s._id).reduce((m, a) => Math.max(m, a.at), 0);
    return at ? [{ id: s._id as string, endedAt: at }] : [];
  });
  return sessionHistory(ideaIds, bank, answers.map((a) => ({ ...toAnswer(a), sessionId: a.sessionId as string })), ended);
}

export const current = query({
  args: { sessionId: v.id("conceptSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx);
    const s = await ownSession(ctx, userId, sessionId);
    if (!s) return null;
    const check = await ctx.db.get(s.checkId);
    const item = s.items[s.position];
    if (!check || !item) return { finished: true as const, position: s.position, total: s.items.length };
    const q = await ctx.db.get(item.questionId);
    if (!q) return { finished: true as const, position: s.position, total: s.items.length };
    const a = await answerFor(ctx, sessionId, q._id);
    const modes = await Promise.all(s.items.map(async (i) => (await ctx.db.get(i.questionId))?.mode ?? "remember"));
    const done = await Promise.all(s.items.map(async (i) => !!(await answerFor(ctx, sessionId, i.questionId))));
    return {
      finished: s.finished,
      position: s.position,
      total: s.items.length,
      modes,
      done,
      question: { id: q._id, mode: q.mode, text: q.question, code: q.code ?? null, active: q.active, options: item.optionOrder.map((id) => ({ id, text: q.options[id] })) },
      feedback: a ? feedbackOf(q, a, check.ideas.find((i) => i.id === q.ideaId)?.name ?? "") : null,
    };
  },
});

export const result = query({
  args: { sessionId: v.id("conceptSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx);
    const s = await ownSession(ctx, userId, sessionId);
    if (!s) return null;
    const check = await ctx.db.get(s.checkId);
    if (!check) return null;
    const rows = await bankOf(ctx, check._id);
    const bank = toBank(rows);
    const active = new Set(bank.map((q) => q.id));
    const all = (await answersOf(ctx, check._id)).filter((a) => active.has(a.questionId));
    const mine = all.filter((a) => a.sessionId === sessionId);
    const before = all.filter((a) => a.at < s.startedAt).map(toAnswer);
    const after = all.map(toAnswer);
    const ideaName = (id: string) => check.ideas.find((i) => i.id === id)?.name ?? "";
    const seen = new Set(mine.map((a) => cellKey(a.ideaId, a.mode)));
    const changes = [...seen].flatMap((key) => {
      const [ideaId, mode] = key.split(":") as [string, Answer["mode"]];
      const inCell = (list: Answer[]) => list.filter((a) => a.ideaId === ideaId && a.mode === mode);
      const from = statusOf(inCell(before));
      const to = statusOf(inCell(after));
      return from === to ? [] : [{ idea: ideaName(ideaId), mode, from, to }];
    });
    const confidentMisses = mine
      .filter((a) => !a.correct && a.confidence === "sure")
      .flatMap((a) => {
        const q = rows.find((r) => r._id === a.questionId);
        return q ? [{ idea: ideaName(a.ideaId), yourAnswer: q.options[a.option], rightAnswer: q.options[q.answer], page: q.page }] : [];
      });
    const usedInNew = mine.find((a) => a.correct && a.confidence !== "guess" && (a.mode === "apply" || a.mode === "analyze"));
    return {
      right: mine.filter((a) => a.correct).length,
      total: mine.length,
      misses: mine.filter((a) => !a.correct).length,
      xp: s.xpEarned,
      headlineIdea: usedInNew ? ideaName(usedInNew.ideaId) : null,
      changes,
      confidentMisses,
      nextCheckAt: check.nextCheckAt ?? null,
    };
  },
});

// ---- A session ----

export const start = mutation({
  args: { checkId: v.id("conceptChecks"), kind: v.union(v.literal("today"), v.literal("misses"), v.literal("anyway")) },
  handler: async (ctx, { checkId, kind }) => {
    const userId = await requireUser(ctx);
    const check = await ownCheck(ctx, userId, checkId);
    if (!check) throw new ConvexError("We couldn't find this check.");
    const open = await ctx.db.query("conceptSessions").withIndex("by_check_finished", (q) => q.eq("checkId", checkId).eq("finished", false)).first();
    if (open) return open._id;
    const bank = toBank(await bankOf(ctx, checkId));
    const answers = (await answersOf(ctx, checkId)).map(toAnswer);
    const now = Date.now();
    const built = buildSession(check.ideas.map((i) => i.id), bank, answers, now, { misses: kind === "misses", anyway: kind === "anyway" });
    if (built.length === 0) throw new ConvexError("There's nothing new to practice right now.");
    return await ctx.db.insert("conceptSessions", {
      userId,
      checkId,
      items: built.map((b) => ({ questionId: b.questionId as Id<"conceptQuestions">, reason: b.reason, optionOrder: shuffled([0, 1, 2, 3]) })),
      position: 0,
      finished: false,
      startedAt: now,
      xpEarned: 0,
    });
  },
});

function shuffled(list: number[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const answer = mutation({
  args: { sessionId: v.id("conceptSessions"), position: v.number(), option: v.number(), confidence: v.union(v.literal("sure"), v.literal("think"), v.literal("guess")) },
  handler: async (ctx, { sessionId, position, option, confidence }) => {
    const userId = await requireUser(ctx);
    const s = await ownSession(ctx, userId, sessionId);
    if (!s) throw new ConvexError("We couldn't find this session.");
    const item = s.items[position];
    if (!item) throw new ConvexError("We couldn't find that question.");
    const q = await ctx.db.get(item.questionId);
    const check = await ctx.db.get(s.checkId);
    if (!q || !check) throw new ConvexError("We couldn't find that question.");
    const name = check.ideas.find((i) => i.id === q.ideaId)?.name ?? "";
    const saved = await answerFor(ctx, sessionId, q._id);
    if (saved) return feedbackOf(q, saved, name); // first answer wins, also across tabs
    if (s.finished || position !== s.position) throw new ConvexError("This question has moved on. Refresh to continue.");
    if (!Number.isInteger(option) || option < 0 || option >= q.options.length) throw new ConvexError("Pick one of the options.");

    const correct = option === q.answer;
    const at = Date.now();
    const history = await answersOf(ctx, check._id);
    const row = { userId, checkId: check._id, sessionId, questionId: q._id, ideaId: q.ideaId, mode: q.mode, option, confidence, correct, at };
    const id = await ctx.db.insert("conceptAnswers", row);

    const key = cellKey(q.ideaId, q.mode);
    const inCell = [...history, row].filter((a) => a.ideaId === q.ideaId && a.mode === q.mode).map((a) => toAnswer(a as Doc<"conceptAnswers">));
    const becameSolid = !check.solidAwarded.includes(key) && statusOf(inCell) === "solid";
    const firstRight = correct && !history.some((a) => a.questionId === q._id && a.correct);
    const rightOnIdea = new Set(history.filter((a) => a.ideaId === q.ideaId && a.correct).map((a) => a.questionId)).size;
    const solidOnIdea = check.solidAwarded.filter((k) => k.startsWith(`${q.ideaId}:`)).length;
    const xp = xpForAnswer({ firstRight, becameSolid, earnedOnIdea: rightOnIdea * RULES.xpFirstRight + solidOnIdea * RULES.xpFirstSolid });
    if (becameSolid) await ctx.db.patch(check._id, { solidAwarded: [...check.solidAwarded, key] });
    if (xp) await ctx.db.patch(sessionId, { xpEarned: s.xpEarned + xp });
    await addXp(ctx, userId, xp);
    return feedbackOf(q, (await ctx.db.get(id))!, name);
  },
});

export const next = mutation({
  args: { sessionId: v.id("conceptSessions"), position: v.number() },
  handler: async (ctx, { sessionId, position }) => {
    const userId = await requireUser(ctx);
    const s = await ownSession(ctx, userId, sessionId);
    if (!s) throw new ConvexError("We couldn't find this session.");
    if (s.finished || position !== s.position) return { finished: s.finished };
    const item = s.items[s.position];
    const q = await ctx.db.get(item.questionId);
    if (q?.active && !(await answerFor(ctx, sessionId, item.questionId))) throw new ConvexError("Answer the question first.");
    const nextPos = s.position + 1;
    const finished = nextPos >= s.items.length;
    await ctx.db.patch(sessionId, { position: finished ? s.position : nextPos, finished });
    if (finished) {
      const check = (await ctx.db.get(s.checkId))!;
      const cells = standing(check.ideas.map((i) => i.id), toBank(await bankOf(ctx, check._id)), (await answersOf(ctx, check._id)).map(toAnswer), Date.now());
      await ctx.db.patch(check._id, { nextCheckAt: nextCheckAt(cells) ?? undefined });
    }
    return { finished };
  },
});

export const report = mutation({
  args: { questionId: v.id("conceptQuestions"), reason: v.union(v.literal("wrong_answer"), v.literal("ambiguous"), v.literal("unsupported"), v.literal("broken_source")) },
  handler: async (ctx, { questionId, reason }) => {
    const userId = await requireUser(ctx);
    const q = await ctx.db.get(questionId);
    if (!q || !(await ownCheck(ctx, userId, q.checkId))) throw new ConvexError("We couldn't find that question.");
    await ctx.db.patch(questionId, { active: false, reportReason: reason });
  },
});

export const saveMisses = mutation({
  args: { sessionId: v.id("conceptSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUser(ctx);
    const s = await ownSession(ctx, userId, sessionId);
    const check = s && (await ctx.db.get(s.checkId));
    if (!s || !check) throw new ConvexError("We couldn't find this session.");
    const saved = await ctx.db.query("savedQuestions").withIndex("by_document", (x) => x.eq("documentId", check.documentId)).take(MAX_SAVED_PER_DOCUMENT);
    const texts = new Set(saved.filter((r) => r.chapterKey === check.chapterKey).map((r) => r.question));
    let count = saved.length;
    let added = 0;
    for (const item of s.items) {
      const a = await answerFor(ctx, sessionId, item.questionId);
      const q = await ctx.db.get(item.questionId);
      if (!a || a.correct || !q || texts.has(q.question)) continue;
      if (count >= MAX_SAVED_PER_DOCUMENT) throw new ConvexError("This book has reached the saved-question limit.");
      await ctx.db.insert("savedQuestions", { userId, documentId: check.documentId, chapterKey: check.chapterKey, question: q.question, yourAnswer: q.options[a.option] ?? "", rightAnswer: q.options[q.answer] ?? "", page: q.page });
      texts.add(q.question);
      count += 1;
      added += 1;
    }
    return { added };
  },
});

// ---- Making questions ----

type Claim =
  | { ok: false; message: string; resetAt?: number }
  | { ok: true; already: true }
  | { ok: true; already: false; checkId: Id<"conceptChecks">; batch: number; ideas: Idea[]; existing: string[]; sourceHash: string };

export const claim = internalMutation({
  args: { userId: v.id("users"), documentId: v.id("documents"), chapterKey: v.string(), sourceHash: v.string(), pagesUsed: v.number(), pagesTotal: v.number() },
  handler: async (ctx, { userId, documentId, chapterKey, sourceHash, pagesUsed, pagesTotal }): Promise<Claim> => {
    if (!(await getOwnDocument(ctx, userId, documentId))) return { ok: false, message: "We couldn't find that book." };
    const now = Date.now();
    let check = await checkFor(ctx, documentId, chapterKey);
    if (check?.generatingBatch && now - (check.generatingAt ?? 0) < LOCK_MS) return { ok: true, already: true };
    if (check && check.batchesDone >= MAX_BATCHES) return { ok: false, message: "You've used all of this chapter's questions." };
    if (check?.failedDay === utcDay(now) && check.failedTries >= MAX_FAILS_PER_DAY) return { ok: false, message: "We couldn't write questions for this chapter today. Try again tomorrow." };
    if (!check) {
      const id = await ctx.db.insert("conceptChecks", { userId, documentId, chapterKey, ideas: [], batchesDone: 0, failedTries: 0, sourceHash, coverage: { pagesUsed, pagesTotal }, solidAwarded: [] });
      check = (await ctx.db.get(id))!;
    }
    const batch = check.batchesDone + 1;
    await ctx.db.patch(check._id, { generatingBatch: batch, generatingAt: now, generatingStage: "Finding the key ideas" });
    const rows = await bankOf(ctx, check._id);
    return { ok: true, already: false, checkId: check._id, batch, ideas: check.ideas, existing: rows.map((r) => r.question), sourceHash: check.sourceHash };
  },
});

export const setStage = internalMutation({
  args: { checkId: v.id("conceptChecks"), stage: v.string() },
  handler: async (ctx, { checkId, stage }) => {
    await ctx.db.patch(checkId, { generatingStage: stage, generatingAt: Date.now() });
  },
});

export const fail = internalMutation({
  args: { checkId: v.id("conceptChecks"), counts: v.boolean() },
  handler: async (ctx, { checkId, counts }) => {
    const c = await ctx.db.get(checkId);
    if (!c) return;
    const day = utcDay(Date.now());
    await ctx.db.patch(checkId, {
      generatingBatch: undefined,
      generatingAt: undefined,
      generatingStage: undefined,
      ...(counts ? { failedDay: day, failedTries: c.failedDay === day ? c.failedTries + 1 : 1 } : {}),
    });
  },
});

const savedQuestion = v.object({
  ideaId: v.string(),
  mode: v.union(v.literal("remember"), v.literal("understand"), v.literal("apply"), v.literal("analyze")),
  difficulty: v.union(v.literal("core"), v.literal("stretch"), v.literal("hard")),
  question: v.string(),
  code: v.optional(v.string()),
  options: v.array(v.string()),
  answer: v.number(),
  explanation: v.string(),
  whyWrong: v.array(v.string()),
  page: v.number(),
  excerpt: v.string(),
  figure: v.optional(v.string()),
});

export const saveBatch = internalMutation({
  args: {
    checkId: v.id("conceptChecks"),
    batch: v.number(),
    sourceHash: v.string(),
    ideas: v.array(v.object({ id: v.string(), name: v.string(), objective: v.string(), page: v.number() })),
    questions: v.array(savedQuestion),
    model: v.string(),
  },
  handler: async (ctx, { checkId, batch, sourceHash, ideas, questions, model }) => {
    const c = await ctx.db.get(checkId);
    if (!c || c.generatingBatch !== batch || c.sourceHash !== sourceHash || !(await ctx.db.get(c.documentId))) return false; // stale
    for (const q of questions) await ctx.db.insert("conceptQuestions", { checkId, batch, ...q, active: true, promptVersion: PROMPT_VERSION, model });
    await ctx.db.patch(checkId, { ideas, batchesDone: batch, generatingBatch: undefined, generatingAt: undefined, generatingStage: undefined, failedTries: 0, failedDay: undefined });
    return true;
  },
});

export const docInfo = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => (await ctx.db.get(documentId))?.sourceType ?? "pdf",
});

type Prepare = { ok: true } | { ok: false; message: string; resetAt?: number };

// One generation call per batch, then free code checks, one small repair, a blind answer check and selection.
export const prepare = action({
  args: { documentId: v.id("documents"), chapterKey: v.string() },
  handler: async (ctx, { documentId, chapterKey }): Promise<Prepare> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, message: "Please log in first." };
    const begin = await ctx.runMutation(internal.chat.begin, { userId, documentId, text: "Make a concept check", kind: "quiz" });
    if (!begin.ok) return begin.message === "Chat isn't available for scanned PDFs." ? { ok: false, message: "Concept checks aren't available for scanned PDFs." } : begin;
    const abort = () => ctx.runMutation(internal.chat.abort, { messageId: begin.messageId });
    const chapter = begin.ranges.find((r) => r.key === chapterKey);
    if (!chapter) {
      await abort();
      return { ok: false, message: "We couldn't find that chapter." };
    }
    const all = await ctx.runQuery(internal.chat.pagesInRange, { documentId, from: chapter.startPage, to: chapter.endPage });
    const pages = fitPages(all, MAX_CHAPTER_CHARS);
    if (pages.reduce((n, p) => n + p.text.trim().length, 0) < 400) {
      await abort();
      return { ok: false, message: "This chapter doesn't have enough text for a concept check." };
    }
    const claimed = await ctx.runMutation(internal.concepts.claim, {
      userId,
      documentId,
      chapterKey,
      sourceHash: hashText(pages.map((p) => p.text).join("\n")),
      pagesUsed: pages.length,
      pagesTotal: chapter.endPage - chapter.startPage + 1,
    });
    if (!claimed.ok || claimed.already) {
      await abort();
      return claimed.ok ? { ok: true } : claimed;
    }
    const { checkId, batch } = claimed;
    try {
      const sourceType = await ctx.runQuery(internal.concepts.docInfo, { documentId });
      const written = await writeBatch({ title: chapter.title, sourceType, pages, batch, ideas: claimed.ideas, existing: claimed.existing }, (stage) => ctx.runMutation(internal.concepts.setStage, { checkId, stage }));
      const { ideas: keptIdeas, questions } = written;
      console.log(`[concept] batch=${batch} raw=${written.stats.raw} valid=${written.stats.valid} served=${questions.length}`);
      const saved = await ctx.runMutation(internal.concepts.saveBatch, { checkId, batch, sourceHash: claimed.sourceHash, ideas: keptIdeas, questions, model: written.model });
      if (!saved) throw new Error("The chapter changed while writing questions.");
      if (batch === 1) await ctx.scheduler.runAfter(0, internal.concepts.linkIdeas, { checkId });
      return { ok: true };
    } catch (err) {
      console.error("[concept] failed", err);
      await ctx.runMutation(internal.concepts.fail, { checkId, counts: true });
      await abort();
      return { ok: false, message: "We couldn't write your questions just now. Try again." };
    }
  },
});

type BatchInput = { title: string; sourceType: string; pages: Page[]; batch: number; ideas: Idea[]; existing: string[] };

// The pipeline: one generation call, free code checks, one small repair, a blind check, then code picks the mix.
export async function writeBatch(input: BatchInput, onStage: (stage: string) => Promise<unknown>) {
  const { title, sourceType, pages, batch, existing } = input;
  const usage = { tokensIn: 0, tokensOut: 0 };
  const track = (r: { tokensIn: number; tokensOut: number }) => {
    usage.tokensIn += r.tokensIn;
    usage.tokensOut += r.tokensOut;
  };
  const profile = sourceProfile(sourceType, pages);
  const block = pages.map((p) => `[page ${p.page}]\n${p.text}`).join("\n\n");
  const generated = await askConceptJson<{ ideas?: unknown; questions?: unknown }>(
    [
      { role: "system", content: `${generationPrompt(batch, profile, input.ideas, existing)}\n\nPAGES:\n${block}` },
      { role: "user", content: `Write the ${batch === 1 ? "ideas and questions" : "questions"} for "${title}".` },
    ],
    { label: `concept-batch-${batch}`, maxTokens: 6000 }
  );
  track(generated);
  const ideas = batch === 1 ? cleanIdeas(generated.data, pages.map((p) => p.page)) : input.ideas;
  if (ideas.length === 0) throw new Error("No usable ideas.");

  await onStage("Checking each question against the book");
  const rawQuestions = Array.isArray(generated.data.questions) ? generated.data.questions : [];
  const rejected: Record<string, number> = {};
  let candidates: Candidate[] = rawQuestions.flatMap((r) => {
    const c = cleanCandidate(r, ideas, pages);
    if (c.ok) return [c.candidate];
    rejected[c.why] = (rejected[c.why] ?? 0) + 1;
    return [];
  });
  const flagged = candidates.filter(correctIsLongest).length;
  candidates = await repairOptions(candidates, track);
  candidates = await blindCheck(candidates, track);

  await onStage("Choosing the best mix");
  const target = batch === 1 ? Math.min(RULES.starterServed, Math.ceil(candidates.length * 0.8)) : candidates.length;
  const chosen = selectQuestions(candidates, target);
  const keptIdeas = batch === 1 ? ideas.filter((i) => chosen.some((c) => c.ideaId === i.id)) : ideas;
  if (chosen.length === 0 || keptIdeas.length === 0) throw new Error("No questions passed the checks.");
  const questions = chosen.map((c) => {
    const placed = placeOptions(c);
    return { ideaId: c.ideaId, mode: c.mode, difficulty: c.difficulty, question: c.question, ...(c.code ? { code: c.code } : {}), ...placed, explanation: c.explanation, page: c.page, excerpt: c.excerpt, ...(c.figure ? { figure: c.figure } : {}) };
  });
  return {
    ideas: keptIdeas,
    questions,
    model: generated.model,
    usage,
    stats: { raw: rawQuestions.length, valid: candidates.length, rejected, flagged, longest: chosen.filter(correctIsLongest).length, guessable: chosen.filter((c) => c.guessable).length },
  };
}

// One try at evening out options. A failed repair never fails the batch: selection drops what's still unbalanced.
async function repairOptions(candidates: Candidate[], track: (r: { tokensIn: number; tokensOut: number }) => void) {
  const flagged = candidates.flatMap((c, n) => (correctIsLongest(c) ? [{ n, question: c.question, correct: c.correct, correctChars: c.correct.length, wrong: c.wrong }] : []));
  if (flagged.length === 0) return candidates;
  try {
    const res = await askConceptJson<{ items?: { n: number; wrong: unknown }[] }>(
      [
        { role: "system", content: REPAIR_PROMPT },
        { role: "user", content: JSON.stringify(flagged) },
      ],
      { label: "concept-repair", maxTokens: 2500 }
    );
    track(res);
    const data = res.data;
    const out = [...candidates];
    for (const item of data.items ?? []) if (flagged.some((f) => f.n === item.n)) out[item.n] = applyRepair(out[item.n], item.wrong);
    return out;
  } catch (err) {
    console.warn("[concept] repair skipped", err);
    return candidates;
  }
}

// A model answers without the source or key. If it still gets a harder question right, that question ranks lower.
async function blindCheck(candidates: Candidate[], track: (r: { tokensIn: number; tokensOut: number }) => void) {
  if (candidates.length === 0) return candidates;
  const shown = candidates.map((c, n) => ({ n, question: c.question, options: placeOptions(c).options }));
  try {
    const res = await askConceptJson<{ answers?: { n: number; choice: number }[] }>(
      [
        { role: "system", content: BLIND_PROMPT },
        { role: "user", content: JSON.stringify(shown) },
      ],
      { label: "concept-blind", maxTokens: 500 }
    );
    track(res);
    const data = res.data;
    const out = [...candidates];
    for (const a of data.answers ?? []) if (out[a.n]) out[a.n] = { ...out[a.n], guessable: a.choice === placeOptions(out[a.n]).answer };
    return out;
  } catch (err) {
    console.warn("[concept] blind check skipped", err);
    return candidates;
  }
}

// Deleting a book removes all its concept data, a batch at a time. Returns true if more is left.
export async function purgeConcepts(ctx: MutationCtx, documentId: Id<"documents">, limit: number) {
  const checks = await ctx.db.query("conceptChecks").withIndex("by_document_chapter", (q) => q.eq("documentId", documentId)).take(limit);
  let budget = limit;
  for (const c of checks) {
    const answers = await ctx.db.query("conceptAnswers").withIndex("by_check_at", (q) => q.eq("checkId", c._id)).take(budget);
    for (const r of answers) await ctx.db.delete(r._id);
    budget -= answers.length;
    if (budget <= 0) return true;
    const sessions = await ctx.db.query("conceptSessions").withIndex("by_check_finished", (q) => q.eq("checkId", c._id)).take(budget);
    for (const r of sessions) await ctx.db.delete(r._id);
    budget -= sessions.length;
    if (budget <= 0) return true;
    const questions = await ctx.db.query("conceptQuestions").withIndex("by_check_mode", (q) => q.eq("checkId", c._id)).take(budget);
    for (const r of questions) await ctx.db.delete(r._id);
    budget -= questions.length;
    if (budget <= 0) return true;
    await ctx.db.delete(c._id);
  }
  return checks.length === limit;
}

// ---- Concept map links (Part 7) ----
// One small call maps how the chapter's ideas relate. New checks get it right after their first batch; older checks
// ask for it when the map opens. Each check gets MAX_LINK_TRIES tries, so a failing call can't repeat forever.
export const mapLinks = action({
  args: { checkId: v.id("conceptChecks") },
  handler: async (ctx, { checkId }): Promise<{ ok: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false };
    const mine = await ctx.runQuery(internal.concepts.linkSource, { checkId, userId });
    if (!mine) return { ok: false };
    await ctx.runAction(internal.concepts.linkIdeas, { checkId });
    return { ok: true };
  },
});

export const linkSource = internalQuery({
  args: { checkId: v.id("conceptChecks"), userId: v.optional(v.id("users")) },
  handler: async (ctx, { checkId, userId }) => {
    const c = await ctx.db.get(checkId);
    if (!c || (userId && c.userId !== userId) || c.links || (c.linkTries ?? 0) >= MAX_LINK_TRIES || c.ideas.length < 2) return null;
    const doc = await ctx.db.get(c.documentId);
    const range = doc && chapterRanges(doc.sections ?? [], doc.pageCount ?? 0).find((r) => r.key === c.chapterKey);
    if (!range) return null;
    return { documentId: c.documentId, ideas: c.ideas, from: range.startPage, to: range.endPage };
  },
});

export const linkIdeas = internalAction({
  args: { checkId: v.id("conceptChecks") },
  handler: async (ctx, { checkId }) => {
    const src = await ctx.runQuery(internal.concepts.linkSource, { checkId });
    if (!src) return;
    if (!(await ctx.runMutation(internal.concepts.startLinks, { checkId }))) return;
    const pages = fitPages(await ctx.runQuery(internal.chat.pagesInRange, { documentId: src.documentId, from: src.from, to: src.to }), MAX_CHAPTER_CHARS);
    const block = pages.map((p) => `[page ${p.page}]\n${p.text}`).join("\n\n");
    try {
      const res = await askConceptJson<{ links?: unknown }>(
        [
          { role: "system", content: `${linksPrompt(src.ideas, RELATIONS)}\n\nPAGES:\n${block}` },
          { role: "user", content: "Map the links." },
        ],
        { label: "concept-links", maxTokens: 900 }
      );
      const links = cleanLinks(res.data, src.ideas.map((i) => i.id));
      console.log(`[concept] links kept=${links.length}`);
      if (links.length) await ctx.runMutation(internal.concepts.saveLinks, { checkId, links });
    } catch (err) {
      console.error("[concept] links failed", err);
    }
  },
});

export const startLinks = internalMutation({
  args: { checkId: v.id("conceptChecks") },
  handler: async (ctx, { checkId }) => {
    const c = await ctx.db.get(checkId);
    if (!c || c.links || (c.linkTries ?? 0) >= MAX_LINK_TRIES) return false;
    await ctx.db.patch(checkId, { linkTries: (c.linkTries ?? 0) + 1 });
    return true;
  },
});

export const saveLinks = internalMutation({
  args: { checkId: v.id("conceptChecks"), links: v.array(v.object({ from: v.string(), to: v.string(), type: v.string(), note: v.string() })) },
  handler: async (ctx, { checkId, links }) => {
    const c = await ctx.db.get(checkId);
    if (!c || c.links) return;
    await ctx.db.patch(checkId, { links });
  },
});
