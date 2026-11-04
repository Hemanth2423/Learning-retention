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
  visual,
  takeaways: v.array(v.object({ title: v.string(), body: v.string() })),
  trap: v.optional(v.object({ misconception: v.string(), correction: v.string() })),
});

// One question in a pillar's pool. Levels decide when it's shown (see the checks feature).
export const check = v.object({
  id: v.string(),
  level: v.union(v.literal("apply"), v.literal("easier"), v.literal("stretch")),
  question: v.string(),
  options: v.array(v.string()),
  answerIndex: v.number(),
  explanation: v.string(),
});

export type SubIdea = Infer<typeof subIdea>;
export type Visual = Infer<typeof visual>;
export type Lesson = Infer<typeof lesson>;
export type Check = Infer<typeof check>;
