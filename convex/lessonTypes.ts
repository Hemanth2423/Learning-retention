// Validators (and TS types) for the concept model and on-demand lessons.
import { Infer, v } from "convex/values";

export const subIdea = v.object({ title: v.string(), detail: v.string(), children: v.array(v.string()) });

const step = v.object({ label: v.string(), detail: v.string() });

// The lesson's one picture. The AI picks the template and fills in the data; the app draws it.
export const visual = v.union(
  v.object({ kind: v.literal("flow"), title: v.string(), steps: v.array(step) }), // process, worked example, timeline
  v.object({ kind: v.literal("cycle"), title: v.string(), steps: v.array(step) }), // loops / flywheels
  v.object({
    kind: v.literal("compare"),
    title: v.string(),
    columns: v.array(v.string()),
    rows: v.array(v.object({ label: v.string(), cells: v.array(v.string()) })),
  }),
  v.object({
    kind: v.literal("matrix"), // 2×2: quadrants are top-left, top-right, bottom-left, bottom-right
    title: v.string(),
    xAxis: v.object({ label: v.string(), low: v.string(), high: v.string() }),
    yAxis: v.object({ label: v.string(), low: v.string(), high: v.string() }),
    quadrants: v.array(step),
  }),
  v.object({
    kind: v.literal("hierarchy"),
    title: v.string(),
    root: v.string(),
    branches: v.array(v.object({ label: v.string(), detail: v.string(), leaves: v.array(v.string()) })),
  })
);

export const lesson = v.object({
  hook: v.string(),
  // Why-first: the problem this idea solves, before any detail. Optional so V1 lessons still load.
  why: v.optional(v.object({ problem: v.string(), idea: v.string() })),
  visual,
  takeaways: v.array(v.object({ title: v.string(), body: v.string() })),
  trap: v.optional(v.object({ misconception: v.string(), correction: v.string() })),
});

// One question in a pillar's pool. Levels decide when it's shown (see the checks feature).
export const check = v.object({
  id: v.string(),
  level: v.union(v.literal("apply"), v.literal("easier"), v.literal("stretch"), v.literal("connect")),
  question: v.string(),
  options: v.array(v.string()),
  answerIndex: v.number(),
  explanation: v.string(),
});

// The practice bank: varied question types, all graded on the server.
// Difficulty level decides when a question is served (see questionFlow.ts).
export const questionLevel = v.union(v.literal("easier"), v.literal("apply"), v.literal("stretch"));
const base = { id: v.string(), level: questionLevel, prompt: v.string(), explanation: v.string() };

export const question = v.union(
  // Multiple choice. style: apply = new scenario, spot = find the misconception, why = pick the reason, core = the idea itself.
  v.object({
    ...base,
    type: v.literal("choice"),
    style: v.union(v.literal("apply"), v.literal("spot"), v.literal("why"), v.literal("core")),
    options: v.array(v.string()),
    answerIndex: v.number(),
  }),
  // Put steps in order. items are stored shuffled; answerOrder lists item indices in the right order.
  v.object({ ...base, type: v.literal("order"), items: v.array(v.string()), answerOrder: v.array(v.number()) }),
  // Match pairs. right is stored shuffled; answerMap[i] is the index in right that belongs to left[i].
  v.object({ ...base, type: v.literal("match"), left: v.array(v.string()), right: v.array(v.string()), answerMap: v.array(v.number()) }),
  // Fill the gap: prompt contains one "___"; any accepted answer counts (small typos allowed).
  v.object({ ...base, type: v.literal("gap"), accepted: v.array(v.string()) })
);

export type SubIdea = Infer<typeof subIdea>;
export type Question = Infer<typeof question>;
export type QuestionLevel = Infer<typeof questionLevel>;
export type Visual = Infer<typeof visual>;
export type Lesson = Infer<typeof lesson>;
export type Check = Infer<typeof check>;
