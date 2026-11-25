"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HistoryPoint } from "@/convex/conceptRules";
import { MODE_INFO, MODE_LIST } from "./shared";

const day = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function OverTime({ history, ideas }: { history: HistoryPoint[]; ideas: number }) {
  const rows = history.map((p, i) => ({ name: `${day(p.at)}${history.filter((q) => day(q.at) === day(p.at)).length > 1 ? ` · ${i + 1}` : ""}`, ...p.solid, right: p.right, total: p.total }));
  const asked = Object.fromEntries(MODE_LIST.map((m) => [m, history.reduce((n, p) => n + p.asked[m], 0)]));
  const most = Math.max(1, ...Object.values(asked));
  const answered = history.reduce((n, p) => n + p.total, 0);

  return (
    <main className="mx-auto max-w-[1080px] px-4 pb-16 pt-3 md:px-7">
      <p className="font-game text-label tracking-wider text-accent-dark">OVER TIME · THIS CHAPTER</p>
      <h1 className="mt-1 font-serif text-h1 font-bold leading-tight">Recall comes first. Using it catches up with spaced sessions.</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
        <section className="rounded-[14px] border border-line bg-card p-3">
          <h2 className="px-1 text-label font-bold uppercase tracking-[0.08em] text-muted">Ideas solid at each level, after each session</h2>
          {rows.length === 0 ? (
            <p className="py-16 text-center text-muted">Finish your first session to start this chart.</p>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 14, right: 18, bottom: 4, left: -18 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
                  <YAxis domain={[0, ideas]} allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
                    labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.name} · ${p[0].payload.right} of ${p[0].payload.total} right` : "")}
                    formatter={(v, key) => [`${v} of ${ideas} ideas`, MODE_INFO[key as keyof typeof MODE_INFO]?.label ?? key]}
                  />
                  {MODE_LIST.map((m) => (
                    <Line key={m} type="monotone" dataKey={m} stroke={MODE_INFO[m].colour} strokeWidth={3} dot={{ r: 4.5, fill: MODE_INFO[m].colour, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pb-1 text-meta text-muted">
            {MODE_LIST.map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5">
                <i className="h-1 w-4 rounded-full" style={{ background: MODE_INFO[m].colour }} />
                {MODE_INFO[m].label}
              </span>
            ))}
          </div>
          <p className="px-1 text-meta text-muted">An idea turns solid only after passes on two different days, so the lines climb slowly by design.</p>
        </section>
        <section className="rounded-[18px] border border-line bg-card p-4">
          <h2 className="text-label font-bold uppercase tracking-[0.08em] text-muted">What&apos;s been tested</h2>
          <div className="mt-2 space-y-2">
            {MODE_LIST.map((m) => (
              <div key={m} className="grid grid-cols-[86px_1fr_28px] items-center gap-2 text-meta">
                <span>{MODE_INFO[m].label}</span>
                <span className="h-2.5 overflow-hidden rounded-full border border-line bg-panel">
                  <i className="block h-full" style={{ width: `${(asked[m] / most) * 100}%`, background: MODE_INFO[m].colour }} />
                </span>
                <span className="text-right font-semibold">{asked[m]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-meta text-muted">
            {answered ? `${answered} questions over ${history.length} session${history.length === 1 ? "" : "s"}. ` : ""}Early sessions lean on recall. As ideas turn solid, more questions ask you to explain, apply and analyze.
          </p>
        </section>
      </div>
      <section className="mt-5 rounded-[18px] border border-line bg-card p-4 md:p-5">
        <h2 className="font-serif text-h3 font-bold">Why it&apos;s built this way</h2>
        <ul className="mt-2 space-y-2 text-meta leading-relaxed">
          <Why tag="Science">
            <b>Testing beats rereading</b> for long-term memory (retrieval practice; Roediger &amp; Karpicke, 2006). Every session is retrieval, not review.
          </Why>
          <Why tag="Science">
            <b>Spaced sessions beat cramming.</b> Recalling something once in each of several spaced sessions keeps more than recalling it many times in one sitting (successive relearning; Rawson &amp; Dunlosky).
          </Why>
          <Why tag="Science">
            <b>Levels follow Bloom&apos;s revised taxonomy</b> (Anderson &amp; Krathwohl, 2001) and Webb&apos;s Depth of Knowledge: remember, understand, apply, analyze.
          </Why>
          <Why tag="Science">
            <b>Confident mistakes</b> are corrected best by feedback (hypercorrection; Butterfield &amp; Metcalfe, 2001), but they can come back, so they&apos;re retested first.
          </Why>
          <Why tag="Product choice">
            Progress is shown as solid, shaky or needs practice, never as a percentage. Not checked isn&apos;t a gap: we just haven&apos;t asked yet.
          </Why>
        </ul>
      </section>
    </main>
  );
}

function Why({ tag, children }: { tag: "Science" | "Product choice"; children: React.ReactNode }) {
  return (
    <li>
      <span className={`mr-1.5 rounded px-1.5 py-px text-[11px] font-bold ${tag === "Science" ? "bg-good-soft text-good" : "bg-accent-soft text-accent-dark"}`}>{tag}</span>
      {children}
    </li>
  );
}
