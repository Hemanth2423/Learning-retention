import { Fragment } from "react";
import type { Visual } from "@/convex/lessonTypes";

// Draws a lesson's picture from structured data. The AI chooses the template; we own the look.
export function LessonVisual({ visual }: { visual: Visual }) {
  return (
    <figure className="card overflow-x-auto">
      <figcaption className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{visual.title}</figcaption>
      {visual.kind === "flow" && <Steps steps={visual.steps} />}
      {visual.kind === "cycle" && <Steps steps={visual.steps} loop />}
      {visual.kind === "compare" && <Compare columns={visual.columns} rows={visual.rows} />}
      {visual.kind === "matrix" && <Matrix v={visual} />}
      {visual.kind === "hierarchy" && <Hierarchy root={visual.root} branches={visual.branches} />}
    </figure>
  );
}

type Step = { label: string; detail: string };

function Steps({ steps, loop }: { steps: Step[]; loop?: boolean }) {
  return (
    <div>
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {steps.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <li aria-hidden="true" className="flex items-center justify-center text-xl text-accent md:px-1">
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </li>
            )}
            <li className="flex-1 rounded-xl border border-line bg-paper p-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-[#1E2A3A]">
                {i + 1}
              </span>
              <p className="mt-2 font-medium leading-snug">{s.label}</p>
              {s.detail && <p className="mt-1 text-sm leading-snug text-muted">{s.detail}</p>}
            </li>
          </Fragment>
        ))}
      </ol>
      {loop && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <span className="text-lg text-accent" aria-hidden="true">↻</span>
          Step {steps.length} feeds back into step 1. It&apos;s a loop.
        </p>
      )}
    </div>
  );
}

function Compare({ columns, rows }: { columns: string[]; rows: { label: string; cells: string[] }[] }) {
  return (
    <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th className="p-2" />
          {columns.map((c, i) => (
            <th key={i} className="rounded-t-lg bg-accent-soft p-2 text-left font-semibold">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <th scope="row" className="border-t border-line p-2 text-left font-medium text-muted">{r.label}</th>
            {r.cells.map((cell, j) => (
              <td key={j} className="border-t border-line p-2 align-top">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Matrix({ v }: { v: Extract<Visual, { kind: "matrix" }> }) {
  const [tl, tr, bl, br] = v.quadrants;
  const cell = (q: Step, strong?: boolean) => (
    <div className={`rounded-xl border p-3 ${strong ? "border-accent bg-accent-soft" : "border-line bg-paper"}`}>
      <p className="font-medium">{q.label}</p>
      <p className="mt-1 text-sm text-muted">{q.detail}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <div className="flex flex-col items-center justify-between py-1 text-xs text-muted">
        <span>{v.yAxis.high}</span>
        <span className="[writing-mode:vertical-rl] rotate-180 font-semibold uppercase tracking-wide">{v.yAxis.label}</span>
        <span>{v.yAxis.low}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cell(tl)}
        {cell(tr, true)}
        {cell(bl)}
        {cell(br)}
      </div>
      <div />
      <div className="flex justify-between text-xs text-muted">
        <span>{v.xAxis.low}</span>
        <span className="font-semibold uppercase tracking-wide">{v.xAxis.label}</span>
        <span>{v.xAxis.high}</span>
      </div>
    </div>
  );
}

function Hierarchy({ root, branches }: { root: string; branches: { label: string; detail: string; leaves: string[] }[] }) {
  return (
    <div className="flex flex-col items-center">
      <span className="rounded-full bg-ink px-4 py-2 font-medium text-paper">{root}</span>
      <span aria-hidden="true" className="h-4 w-px bg-line" />
      <ul className="grid w-full gap-3 border-t-2 border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b, i) => (
          <li key={i} className="rounded-xl border border-line bg-paper p-3">
            <p className="font-medium">{b.label}</p>
            {b.detail && <p className="mt-1 text-sm text-muted">{b.detail}</p>}
            {b.leaves.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {b.leaves.map((l, j) => (
                  <li key={j} className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">{l}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
