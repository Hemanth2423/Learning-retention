// Pure rules that check and clean what the AI returns for a lesson. No AI judgment lives here:
// these decide what is allowed to reach the learner.
import { Check, SubIdea, Visual } from "./lessonTypes";

// Questions must test the idea, not memory of the text.
const BANNED = /\b(according to|the (source|text|author|authors|chapter|document|passage|reading|book|slides?|deck|lecture))\b/i;

export function mentionsSource(s: string) {
  return BANNED.test(s);
}

type RawCheck = Partial<Omit<Check, "id">> & { type?: string };

// Keeps well-formed, source-free questions, at most one per level, with options shuffled so the
// right answer isn't always in the same spot. Returns null if the pool is too weak to use.
export function cleanChecks(raw: RawCheck[] | undefined, random = Math.random): Check[] | null {
  const levels = ["apply", "easier", "stretch"] as const;
  // Models sometimes drop the level or call it "type"; fall back to the requested order.
  const labelled = (raw ?? []).map((c, i) => ({ ...c, level: (c.level ?? c.type ?? levels[i]) as Check["level"] }));
  const out: Check[] = [];
  for (const level of levels) {
    const q = labelled.find(
      (c) =>
        c.level === level &&
        typeof c.question === "string" &&
        Array.isArray(c.options) &&
        c.options.length === 4 &&
        typeof c.answerIndex === "number" &&
        c.answerIndex >= 0 &&
        c.answerIndex < 4 &&
        ![c.question, ...c.options].some(mentionsSource)
    );
    if (!q) continue;
    const order = shuffle([0, 1, 2, 3], random);
    out.push({
      id: level,
      level,
      question: q.question!,
      options: order.map((i) => q.options![i]),
      answerIndex: order.indexOf(q.answerIndex!),
      explanation: q.explanation ?? "",
    });
  }
  // The flow needs an "apply" question to start and an "easier" one to fall back to.
  const has = (l: string) => out.some((c) => c.level === l);
  return has("apply") && has("easier") ? out : null;
}

// End-of-course questions: same rules, all level "connect". Needs at least 2 usable questions.
export function cleanConnectChecks(raw: RawCheck[] | undefined, random = Math.random): Check[] | null {
  const out: Check[] = [];
  for (const q of raw ?? []) {
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.answerIndex !== "number" ||
      q.answerIndex < 0 ||
      q.answerIndex > 3 ||
      [q.question, ...q.options].some(mentionsSource)
    )
      continue;
    const order = shuffle([0, 1, 2, 3], random);
    out.push({
      id: `connect-${out.length}`,
      level: "connect",
      question: q.question,
      options: order.map((i) => q.options![i]),
      answerIndex: order.indexOf(q.answerIndex),
      explanation: q.explanation ?? "",
    });
    if (out.length === 3) break;
  }
  return out.length >= 2 ? out : null;
}

function shuffle<T>(arr: T[], random: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isStr = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const isSteps = (s: unknown) =>
  Array.isArray(s) && s.length >= 2 && s.every((x) => isStr(x?.label) && typeof x?.detail === "string");

// Accepts the AI's visual only if it matches a template we can draw. Otherwise draws the pillar's
// own sub-ideas as a hierarchy, so a lesson always has a picture.
export function cleanVisual(raw: unknown, pillarTitle: string, subIdeas: SubIdea[]): Visual {
  const r = raw as Record<string, unknown> | undefined;
  const title = isStr(r?.title) ? (r.title as string) : pillarTitle;
  if (r?.kind === "flow" || r?.kind === "cycle") {
    if (isSteps(r.steps)) return { kind: r.kind, title, steps: (r.steps as { label: string; detail: string }[]).slice(0, 7) };
  }
  if (r?.kind === "compare") {
    const cols = r.columns as unknown[];
    const rows = r.rows as { label: string; cells: unknown[] }[];
    if (
      Array.isArray(cols) && cols.length >= 2 && cols.every(isStr) &&
      Array.isArray(rows) && rows.length >= 2 &&
      rows.every((row) => isStr(row?.label) && Array.isArray(row.cells) && row.cells.length === cols.length && row.cells.every(isStr))
    ) {
      return { kind: "compare", title, columns: cols as string[], rows: rows.slice(0, 6) as { label: string; cells: string[] }[] };
    }
  }
  if (r?.kind === "matrix") {
    const axis = (a: unknown) => {
      const o = a as Record<string, unknown> | undefined;
      return isStr(o?.label) && isStr(o?.low) && isStr(o?.high) ? { label: o.label as string, low: o.low as string, high: o.high as string } : null;
    };
    const x = axis(r.xAxis);
    const y = axis(r.yAxis);
    if (x && y && isSteps(r.quadrants) && (r.quadrants as unknown[]).length === 4) {
      return { kind: "matrix", title, xAxis: x, yAxis: y, quadrants: r.quadrants as { label: string; detail: string }[] };
    }
  }
  if (r?.kind === "hierarchy") {
    const branches = r.branches as { label: string; detail?: string; leaves?: unknown[] }[];
    if (isStr(r.root) && Array.isArray(branches) && branches.length >= 2 && branches.every((b) => isStr(b?.label))) {
      return {
        kind: "hierarchy",
        title,
        root: r.root as string,
        branches: branches.slice(0, 5).map((b) => ({
          label: b.label,
          detail: typeof b.detail === "string" ? b.detail : "",
          leaves: (b.leaves ?? []).filter(isStr).slice(0, 4),
        })),
      };
    }
  }
  return {
    kind: "hierarchy",
    title: pillarTitle,
    root: pillarTitle,
    branches: subIdeas.map((s) => ({ label: s.title, detail: s.detail, leaves: s.children })),
  };
}
