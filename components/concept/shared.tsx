import type { Mode, Status } from "@/convex/conceptRules";

export const MODE_INFO: Record<Mode, { label: string; verb: string; about: string; example: string; challenge: string; colour: string }> = {
  remember: { label: "Remember", verb: "Recall", about: "Identify a key fact or relationship.", example: "What has to happen first?", challenge: "Identify the idea", colour: "#d9b45f" },
  understand: { label: "Understand", verb: "Explain", about: "Choose the accurate explanation.", example: "Why does this work?", challenge: "Choose the best explanation", colour: "#c98560" },
  apply: { label: "Apply", verb: "Apply", about: "Use the idea in a new situation.", example: "What should this team do?", challenge: "Predict the outcome", colour: "#a8492a" },
  analyze: { label: "Analyze", verb: "Analyze", about: "Weigh evidence and diagnose problems.", example: "Why did this plan fail?", challenge: "Diagnose the failure", colour: "#5d4a73" },
};
export const MODE_LIST: Mode[] = ["remember", "understand", "apply", "analyze"];

const STATUS: Record<Status, { label: string; className: string }> = {
  solid: { label: "Solid", className: "border-good-line bg-good-soft text-good" },
  shaky: { label: "Shaky", className: "border-[#e2c677] bg-[#faedc8] text-[#6e5413]" },
  needs_practice: { label: "Needs practice", className: "border-[#e0b6a1] bg-accent-soft text-accent-dark" },
  not_checked: { label: "Not checked", className: "border-dashed border-line bg-transparent text-muted" },
};

const HATCH = "repeating-linear-gradient(45deg, var(--panel), var(--panel) 6px, var(--cream) 6px, var(--cream) 12px)";

// `block` is the grid version: a taller filled cell, with Not checked hatched so it never reads as a failure.
export function StatusPill({ status, block = false }: { status: Status; block?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex w-full items-center justify-center border px-1.5 text-center font-semibold ${block ? "min-h-10 rounded-[10px] text-meta" : "min-h-7 rounded-lg py-0.5 text-label"} ${s.className}`}
      style={block && status === "not_checked" ? { background: HATCH, borderStyle: "solid", fontWeight: 500 } : undefined}
    >
      {s.label}
    </span>
  );
}

export function StatusLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
      {(["solid", "shaky", "needs_practice", "not_checked"] as Status[]).map((st) => (
        <span key={st} className="inline-flex items-center gap-1.5">
          <i className={`size-3.5 rounded border ${STATUS[st].className}`} style={st === "not_checked" ? { background: HATCH, borderStyle: "solid" } : undefined} />
          {STATUS[st].label}
          {st === "solid" ? ": passes on 2+ days" : st === "not_checked" ? ": not asked yet, not a gap" : ""}
        </span>
      ))}
    </div>
  );
}

export const statusLabel = (s: Status) => STATUS[s].label;

export function dayLabel(at: number) {
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return new Date(at).toLocaleDateString(undefined, Math.abs(days) < 7 ? { weekday: "long" } : { month: "short", day: "numeric" });
}
