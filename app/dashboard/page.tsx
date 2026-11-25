"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dayLabel, MODE_INFO, MODE_LIST } from "@/components/concept/shared";
import { timeAgo } from "@/components/library/time";
import { ReadingShell } from "@/components/ReadingShell";
import { TopNav } from "@/components/TopNav";
import { api } from "@/convex/_generated/api";

type View = "reading" | "testing";
type Overview = NonNullable<ReturnType<typeof useQuery<typeof api.insights.overview>>>;

export default function DashboardPage() {
  return (
    <ReadingShell chrome={false}>
      <TopNav />
      <Dashboard />
    </ReadingShell>
  );
}

function Dashboard() {
  const [tzOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const data = useQuery(api.insights.overview, { tzOffsetMinutes });
  const [view, setView] = useState<View>("reading");
  return (
    <main className="mx-auto w-full max-w-[1120px] px-4 pb-20 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-game text-label tracking-wider text-accent-dark">DASHBOARD</p>
          <h1 className="mt-1 font-serif text-h1 font-bold">{view === "reading" ? "Your reading, chapter by chapter" : "What you know, and what's next"}</h1>
        </div>
        <div role="tablist" aria-label="Dashboard view" className="inline-flex gap-1 rounded-xl bg-panel p-1">
          {(["reading", "testing"] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-lg px-4 py-1.5 text-meta font-semibold ${view === v ? "bg-card text-accent-dark shadow-[0_1px_2px_rgba(42,34,27,.08)]" : "text-muted hover:text-ink"}`}
            >
              {v === "reading" ? "📖 Reading" : "🧠 Testing"}
            </button>
          ))}
        </div>
      </div>
      {data === undefined ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-card/60" />
          ))}
        </div>
      ) : view === "reading" ? (
        <Reading data={data} />
      ) : (
        <Testing data={data} />
      )}
    </main>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4" style={accent ? { borderTop: `5px solid ${accent}` } : undefined}>
      <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-[30px] font-bold leading-none">{value}</p>
      {hint && <p className="mt-1.5 text-meta text-muted">{hint}</p>}
    </div>
  );
}

function Bar2({ value, total, colour = "var(--good)" }: { value: number; total: number; colour?: string }) {
  return (
    <span className="block h-2.5 overflow-hidden rounded-full border border-line bg-panel">
      <i className="block h-full rounded-full" style={{ width: `${total ? (value / total) * 100 : 0}%`, background: colour }} />
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="mt-6 rounded-2xl border border-dashed border-line bg-card/50 p-8 text-center text-muted">{children}</div>;
}

// ---- Reading ----
function Reading({ data }: { data: Overview }) {
  const books = data.books.filter((b) => b.chapters.length > 0);
  const chapters = books.flatMap((b) => b.chapters);
  const pagesRead = chapters.reduce((n, c) => n + c.seen, 0);
  const finished = chapters.filter((c) => c.seen === c.pages).length;
  const started = books.filter((b) => b.chapters.some((c) => c.seen > 0)).length;
  const notes = data.books.reduce((n, b) => n + b.notes, 0);
  const highlights = data.books.reduce((n, b) => n + b.highlights, 0);
  if (books.length === 0) return <Empty>Add a book to your <Link className="underline" href="/read">library</Link> and your reading shows up here.</Empty>;
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pages read" value={pagesRead} hint={`Across ${started} of ${books.length} source${books.length === 1 ? "" : "s"}`} accent="var(--ochre)" />
        <Stat label="Chapters finished" value={finished} hint={`of ${chapters.length} chapters`} accent="var(--good)" />
        <Stat label="Notes" value={notes} hint="Written in your notebooks" accent="var(--accent)" />
        <Stat label="Highlights" value={highlights} hint="Marked while reading" accent="#5d4a73" />
      </div>
      <div className="mt-5 space-y-4">
        {books.map((b) => (
          <BookReading key={b.id} book={b} />
        ))}
      </div>
    </>
  );
}

function BookReading({ book }: { book: Overview["books"][number] }) {
  const [now] = useState(() => Date.now());
  const pages = book.chapters.reduce((n, c) => n + c.pages, 0);
  const seen = book.chapters.reduce((n, c) => n + c.seen, 0);
  const done = book.chapters.filter((c) => c.seen === c.pages).length;
  const first = book.chapters.slice(0, 6);
  const rest = book.chapters.slice(6);
  const unit = book.sourceType === "pdf" ? "pages" : "sections";
  return (
    <section className="rounded-[18px] border border-line bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-h2 font-bold">{book.title}</h2>
          <p className="text-meta text-muted">
            {done} of {book.chapters.length} chapters finished · {seen} of {pages} {unit} · {book.lastReadAt ? `last read ${timeAgo(book.lastReadAt, now)}` : "not opened yet"}
          </p>
        </div>
        <Link href={`/read/${book.id}`} className="chunky sm">
          {seen ? "Continue" : "Start"} →
        </Link>
      </div>
      <div className="mt-3">
        <Bar2 value={seen} total={pages} colour="var(--accent)" />
      </div>
      <ul className="mt-4 divide-y divide-line">
        {first.map((c) => (
          <ChapterRow key={c.key} c={c} unit={unit} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer py-2 text-meta font-semibold text-accent-dark">Show {rest.length} more</summary>
          <ul className="divide-y divide-line">
            {rest.map((c) => (
              <ChapterRow key={c.key} c={c} unit={unit} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ChapterRow({ c, unit }: { c: Overview["books"][number]["chapters"][number]; unit: string }) {
  const state = c.seen === c.pages ? { t: "Finished", k: "bg-good-soft text-good border-good-line" } : c.seen ? { t: "Reading", k: "bg-[#faedc8] text-[#6e5413] border-[#e2c677]" } : { t: "Not started", k: "border-dashed border-line text-muted" };
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
      <span className="truncate font-semibold" title={c.title}>{c.title}</span>
      <span className={`rounded-full border px-2 py-0.5 text-label font-semibold md:order-last ${state.k}`}>{state.t}</span>
      <span className="flex items-center gap-2 text-meta text-muted max-md:col-span-2">
        <span className="flex-1"><Bar2 value={c.seen} total={c.pages} /></span>
        <span className="whitespace-nowrap">{c.seen}/{c.pages} {unit}</span>
      </span>
      <span className="flex gap-1.5 text-label text-muted max-md:col-span-2">
        <span className="rounded-md bg-panel px-1.5 py-0.5" title="Notes">📝 {c.notes}</span>
        <span className="rounded-md bg-panel px-1.5 py-0.5" title="Highlights">🖍 {c.highlights}</span>
      </span>
    </li>
  );
}

// ---- Testing ----
function Testing({ data }: { data: Overview }) {
  const answered = data.tests.reduce((n, t) => n + t.answered, 0);
  const right = data.tests.reduce((n, t) => n + t.right, 0);
  const ideas = data.tests.reduce((n, t) => n + t.ideas, 0);
  const solidRecall = data.tests.reduce((n, t) => n + t.solid.remember, 0);
  const due = data.tests.filter((t) => t.due).length;
  const week = data.activity.slice(-7).reduce((n, d) => n + d.right + d.missed, 0);
  if (data.tests.length === 0)
    return <Empty>Open a chapter and choose <b>Test yourself</b> to make your first concept check. Your results show up here.{data.quickTests ? ` You've taken ${data.quickTests} quick tests so far.` : ""}</Empty>;
  const rows = data.activity.map((d) => ({ ...d, name: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) }));
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Questions answered" value={answered} hint={`${week} in the last 7 days`} accent="var(--ochre)" />
        <Stat label="Right answers" value={<>{right}<span className="text-h3 font-semibold text-muted"> of {answered}</span></>} hint="Across every concept check" accent="var(--good)" />
        <Stat label="Solid recall" value={<>{solidRecall}<span className="text-h3 font-semibold text-muted"> of {ideas}</span></>} hint="Ideas you remember on 2+ days" accent={MODE_INFO.remember.colour} />
        <Stat label="Due now" value={due} hint={due ? "Chapters ready to review" : "Nothing due. Nice."} accent="var(--accent)" />
      </div>
      <section className="mt-4 rounded-[18px] border border-line bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-h3 font-bold">Last 14 days</h2>
          <p className="text-meta text-muted">Answers per day</p>
        </div>
        <div className="mt-2 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--panel)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} formatter={(v, k) => [v, k === "right" ? "Right" : "Missed"]} />
              <Bar dataKey="right" stackId="a" fill="var(--good)" radius={[0, 0, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="missed" stackId="a" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 text-meta text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-good" />Right</span>
          <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-accent" />Missed</span>
        </div>
      </section>
      <section className="mt-4 rounded-[18px] border border-line bg-card p-4 md:p-5">
        <h2 className="font-serif text-h3 font-bold">By chapter</h2>
        <p className="text-meta text-muted">Ideas solid at each level. Not checked isn&apos;t a gap.</p>
        <ul className="mt-3 space-y-3">
          {data.tests.map((t) => (
            <li key={`${t.documentId}-${t.chapterKey}`} className="rounded-2xl border border-line bg-paper/40 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">{t.bookTitle}</p>
                  <h3 className="truncate font-serif text-h3 font-bold">{t.chapterTitle}</h3>
                  <p className="text-meta text-muted">
                    {t.checked} of {t.ideas} ideas checked · {t.right} of {t.answered} right
                    {t.nextCheckAt ? (t.due ? " · ready to review" : ` · next check ${dayLabel(t.nextCheckAt)}`) : ""}
                  </p>
                </div>
                <Link href={`/read/${t.documentId}/test?chapter=${encodeURIComponent(t.chapterKey)}`} className={t.due ? "chunky sm" : "quiet"}>
                  {t.due ? "Review now" : "Open check"}
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {MODE_LIST.map((m) => (
                  <div key={m} className="text-meta">
                    <div className="flex justify-between">
                      <span>{MODE_INFO[m].label}</span>
                      <b>
                        {t.solid[m]}/{t.ideas}
                      </b>
                    </div>
                    <div className="mt-1">
                      <Bar2 value={t.solid[m]} total={t.ideas} colour={MODE_INFO[m].colour} />
                    </div>
                  </div>
                ))}
              </div>
              {t.needsPractice > 0 && <p className="mt-2 text-meta font-semibold text-accent-dark">{t.needsPractice} idea-level{t.needsPractice === 1 ? "" : "s"} need practice</p>}
            </li>
          ))}
        </ul>
        {data.quickTests > 0 && <p className="mt-3 text-meta text-muted">Plus {data.quickTests} quick test{data.quickTests === 1 ? "" : "s"}, scored separately.</p>}
      </section>
    </>
  );
}
