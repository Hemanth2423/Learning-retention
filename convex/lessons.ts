// Step 2 of the pipeline: build one pillar's lesson ON DEMAND, from the concept model only
// (a few thousand tokens), never the full document.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, MutationCtx } from "./_generated/server";
import { requireUser } from "./helpers";
import { cleanChecks, cleanVisual } from "./lessonRules";
import { check, lesson } from "./lessonTypes";
import { askJson, SearchResult, webSearch } from "./llm";

async function queue(ctx: MutationCtx, topicId: Id<"topics">) {
  const topic = await ctx.db.get(topicId);
  if (!topic || topic.lessonStatus === "ready" || topic.lessonStatus === "generating") return;
  await ctx.db.patch(topicId, { lessonStatus: "generating", lessonError: undefined });
  await ctx.scheduler.runAfter(0, internal.lessons.generate, { topicId });
}

// Called when a learner opens a pillar: builds it if needed, and builds the NEXT pillar in the
// background so "Next" is instant. Pillars nobody reaches are never generated (no tokens spent).
export const ensure = mutation({
  args: { topicId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const topicId = ctx.db.normalizeId("topics", args.topicId);
    const topic = topicId ? await ctx.db.get(topicId) : null;
    if (!topic || topic.userId !== userId) return;
    await queue(ctx, topic._id);
    const next = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", topic.courseId).eq("order", topic.order + 1))
      .unique();
    if (next) await queue(ctx, next._id);
  },
});

export const context = internalQuery({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    const topic = await ctx.db.get(topicId);
    if (!topic) return null;
    const course = await ctx.db.get(topic.courseId);
    const siblings = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", topic.courseId))
      .collect();
    return {
      topic,
      courseTitle: course?.title ?? "",
      thesis: course?.thesis ?? "",
      links: (course?.conceptLinks ?? []).filter((l) => l.from === topic.title || l.to === topic.title),
      otherPillars: siblings.filter((s) => s._id !== topicId).map((s) => s.title),
    };
  },
});

type LessonContext = {
  topic: Doc<"topics">;
  courseTitle: string;
  thesis: string;
  links: { from: string; to: string; relation: string }[];
  otherPillars: string[];
};

type LessonReply = {
  hook: string;
  visual: unknown;
  takeaways: { title: string; body: string }[];
  trap?: { misconception: string; correction: string };
  examples: { title: string; description: string; sourceIndex: number }[];
  checks: { level: "apply" | "easier" | "stretch"; question: string; options: string[]; answerIndex: number; explanation: string }[];
};

const RULES = `You write one short, visual lesson that teaches a PILLAR to someone who will never read the original material.

Return JSON:
{
  "hook": "1–2 sentences: why this idea matters in practice",
  "visual": ONE of these templates, whichever shows the idea best:
    { "kind": "flow", "title": "...", "steps": [{ "label": "≤ 4 words", "detail": "1 short sentence" }] }   — a process, sequence, or worked example (3–6 steps)
    { "kind": "cycle", "title": "...", "steps": [...] }   — a loop or flywheel (3–6 steps)
    { "kind": "compare", "title": "...", "columns": ["A", "B"], "rows": [{ "label": "...", "cells": ["...", "..."] }] }   — contrasting options (2–3 columns, 3–5 rows, cells ≤ 8 words)
    { "kind": "matrix", "title": "...", "xAxis": { "label": "...", "low": "...", "high": "..." }, "yAxis": { ... }, "quadrants": [{ "label": "...", "detail": "..." }] }   — a 2×2; quadrants in order top-left, top-right, bottom-left, bottom-right
    { "kind": "hierarchy", "title": "...", "root": "...", "branches": [{ "label": "...", "detail": "...", "leaves": ["..."] }] }   — parts of a whole (2–5 branches)
  "takeaways": [{ "title": "≤ 6 words", "body": "2–3 sentences that TEACH the insight so it makes sense on its own" }],   — 3–5, covering every insight given
  "trap": { "misconception": "one wrong belief from the list", "correction": "1–2 sentences on what's actually true" },
  "examples": [{ "title": "short name of the real case", "description": "2–3 sentences: what happened and how it shows this idea", "sourceIndex": <number of the web result> }],
  "checks": [
    { "level": "apply", "question": "...", "options": ["...", "...", "...", "..."], "answerIndex": 0, "explanation": "..." },
    { "level": "easier", ... },
    { "level": "stretch", ... }
  ]
}

Examples: up to 2, each a real case actually described in the WEB RESULTS. If none fit, return []. Never invent cases or URLs.

Checks: exactly three, each with 4 options, answerIndex (0–3), and a 1–2 sentence explanation.
- "apply": a short NEW scenario (not one from the material) where the learner must recognise which idea or action applies.
- "easier": a plain check of the core idea itself, no scenario.
- "stretch": a scenario with a nuance or edge case, or one that links this pillar to another pillar.
- Wrong options must be plausible. Base them on the misconceptions so a wrong pick reveals the misunderstanding.
- Test understanding, not recall. Never say "according to", "the source", "the text", "the author", "the chapter", or "the document".`;

function lessonPrompt(c: LessonContext, results: SearchResult[]) {
  const t = c.topic;
  const web = results.length
    ? results.map((r, i) => `[${i + 1}] ${r.title} — ${r.url}\n${r.description}`).join("\n\n")
    : "(no web results)";
  return `COURSE: ${c.courseTitle}
BIG IDEA: ${c.thesis}
OTHER PILLARS: ${c.otherPillars.join("; ")}
LINKS: ${c.links.map((l) => `${l.from} → ${l.relation} → ${l.to}`).join("; ") || "(none)"}

PILLAR: ${t.title}
SUMMARY: ${t.summary}
SUB-IDEAS:
${t.subIdeas.map((s) => `- ${s.title}: ${s.detail}${s.children.length ? ` (${s.children.join(", ")})` : ""}`).join("\n")}
INSIGHTS:
${t.insights.map((i) => `- ${i.text}${i.quote ? ` [supporting phrase: "${i.quote}"]` : ""}`).join("\n")}
MISCONCEPTIONS:
${t.misconceptions.map((m) => `- ${m}`).join("\n")}

WEB RESULTS:
${web}`;
}
export const generate = internalAction({
  args: { topicId: v.id("topics") },
  handler: async (ctx, { topicId }) => {
    try {
      const c = await ctx.runQuery(internal.lessons.context, { topicId });
      if (!c) return;
      const results = await webSearch(c.topic.searchQuery);
      const prompt = lessonPrompt(c, results);

      let reply: LessonReply | null = null;
      let checks = null;
      // One retry if the questions break the rules (e.g. mention "the source" or are malformed).
      for (let attempt = 0; attempt < 2 && !checks; attempt++) {
        reply = await askJson<LessonReply>(
          [
            { role: "system", content: RULES },
            {
              role: "user",
              content: attempt === 0 ? prompt : `${prompt}\n\nYour previous checks broke the rules. Follow the Checks rules exactly.`,
            },
          ],
          { model: "deepseek-flash", label: `lesson:${c.topic.title}` }
        );
        checks = cleanChecks(reply.checks);
        if (!checks) console.log(`[checks rejected] ${JSON.stringify(reply.checks)?.slice(0, 1500)}`);
      }
      if (!reply || !checks) throw new Error("Couldn't write good questions for this pillar.");

      await ctx.runMutation(internal.lessons.save, {
        topicId,
        lesson: {
          hook: reply.hook ?? c.topic.summary,
          visual: cleanVisual(reply.visual, c.topic.title, c.topic.subIdeas),
          takeaways: (reply.takeaways ?? []).filter((t) => t?.title && t?.body).slice(0, 5),
          trap: reply.trap?.misconception && reply.trap?.correction ? reply.trap : undefined,
        },
        examples: (reply.examples ?? [])
          .filter((e) => results[e.sourceIndex - 1]) // only keep examples tied to a real search result
          .slice(0, 2)
          .map((e) => ({ title: e.title, description: e.description, sourceUrl: results[e.sourceIndex - 1].url })),
        checks,
      });
    } catch (err) {
      await ctx.runMutation(internal.lessons.fail, {
        topicId,
        message: err instanceof Error ? err.message : "Something went wrong building this lesson.",
      });
    }
  },
});

export const save = internalMutation({
  args: {
    topicId: v.id("topics"),
    lesson,
    examples: v.array(v.object({ title: v.string(), description: v.string(), sourceUrl: v.string() })),
    checks: v.array(check),
  },
  handler: async (ctx, { topicId, ...fields }) => {
    if (await ctx.db.get(topicId)) await ctx.db.patch(topicId, { ...fields, lessonStatus: "ready", lessonError: undefined });
  },
});

export const fail = internalMutation({
  args: { topicId: v.id("topics"), message: v.string() },
  handler: async (ctx, { topicId, message }) => {
    if (await ctx.db.get(topicId)) await ctx.db.patch(topicId, { lessonStatus: "failed", lessonError: message });
  },
});
