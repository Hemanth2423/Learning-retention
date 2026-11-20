"use client";

import { CitedText } from "@/components/reader/CitedText";
import { NotebookState } from "./useNotebook";

export type CheckResult = Extract<Awaited<ReturnType<NotebookState["validate"]>>, { ok: true }>;

const statusLabel = { supported: "Matches the book", incorrect: "Not quite", not_in_book: "Not covered in these pages" } as const;
const statusMark = { supported: "✓", incorrect: "✗", not_in_book: "?" } as const;

export function ValidationCard({ result, onJump, onClose }: { result: CheckResult; onJump: (page: number) => void; onClose: () => void }) {
  const { verdict, summary, checks } = result.result;
  const title = verdict === "accurate" ? "Looks accurate" : verdict === "has_issues" ? "A few things to check" : "Couldn't check this";
  return (
    <section aria-label="Validation" className="max-h-[45%] shrink-0 overflow-y-auto border-t border-line bg-paper p-4 text-ui">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={onClose} aria-label="Close validation" className="text-muted hover:text-ink">
          ✕
        </button>
      </div>
      {summary && (
        <p className="mt-1 text-muted">
          <CitedText text={summary} pages={result.pages} onJump={onJump} />
        </p>
      )}
      <ul className="mt-3 space-y-2.5">
        {checks.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className={`mt-0.5 w-4 shrink-0 text-center font-bold ${c.status === "supported" ? "text-good" : c.status === "incorrect" ? "text-bad" : "text-muted"}`}>
              {statusMark[c.status]}
            </span>
            <div className="min-w-0">
              <p>
                {c.claim} <span className="text-label text-muted">· {statusLabel[c.status]}</span>
              </p>
              {c.correction && (
                <p className="mt-0.5 text-muted">
                  <CitedText text={c.correction} pages={result.pages} onJump={onJump} />
                </p>
              )}
              {c.citations.length > 0 && !c.correction && (
                <p className="mt-0.5">
                  <CitedText text={c.citations.map((n) => `[${n}]`).join("")} pages={result.pages} onJump={onJump} />
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
