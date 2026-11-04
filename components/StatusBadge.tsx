const STYLES = {
  processing: "bg-accent-soft text-ink",
  ready: "bg-good/15 text-good",
  failed: "bg-bad/15 text-bad",
} as const;

const LABELS = { processing: "Processing…", ready: "Ready", failed: "Failed" } as const;

export function StatusBadge({ status }: { status: keyof typeof STYLES }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>{LABELS[status]}</span>;
}
