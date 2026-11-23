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

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`inline-flex min-h-7 w-full items-center justify-center rounded-lg border px-1.5 py-0.5 text-center text-label font-semibold ${s.className}`}>{s.label}</span>;
}

export const statusLabel = (s: Status) => STATUS[s].label;

export function dayLabel(at: number) {
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return new Date(at).toLocaleDateString(undefined, Math.abs(days) < 7 ? { weekday: "long" } : { month: "short", day: "numeric" });
}
