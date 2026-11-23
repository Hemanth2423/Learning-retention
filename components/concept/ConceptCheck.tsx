"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { Bulb } from "@/components/icons/Bulb";
import { XpStats } from "@/components/XpStats";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Cell, Mode } from "@/convex/conceptRules";
import { ConceptSession } from "./ConceptSession";
import { dayLabel, MODE_INFO, MODE_LIST, statusLabel, StatusPill } from "./shared";

type Tab = "ideas" | "practice" | "stand";
const STAGES = ["Finding the key ideas", "Checking each question against the book", "Choosing the best mix"];

export function ConceptCheck({
  documentId,
  chapterKey,
  eyebrow,
  title,
  isPdf,
  pageLabel,
  oldBest,
}: {
  documentId: Id<"documents">;
  chapterKey: string;
  eyebrow: string;
  title: string;
  isPdf: boolean;
  pageLabel: string;
  oldBest: { best: number; total: number } | null;
}) {
  const check = useQuery(api.concepts.get, { documentId, chapterKey });
  const quota = useQuery(api.chat.quota, {});
  const prepare = useAction(api.concepts.prepare);
  const start = useMutation(api.concepts.start);
  const [tab, setTab] = useState<Tab>("ideas");
  const [sessionId, setSessionId] = useState<Id<"conceptSessions"> | null>(null);
  const [finished, setFinished] = useState<Id<"conceptSessions"> | null>(null);
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathHref = `/read/${documentId}`;
  const classicHref = `/read/${documentId}/test?chapter=${encodeURIComponent(chapterKey)}&classic=1`;
  const pageHref = useCallback((page: number) => `/read/${documentId}/book?page=${page}`, [documentId]);
  const onDone = useCallback(() => {
    setSessionId((id) => {
      if (id) setFinished(id);
      return null;
    });
    setTab("stand");
  }, []);

  const make = async () => {
    setMaking(true);
    setError(null);
    const res = await prepare({ documentId, chapterKey }).catch(() => ({ ok: false as const, message: "We couldn't write your questions just now. Try again." }));
    setMaking(false);
    if (!res.ok) setError(res.message);
  };
  const begin = async (kind: "today" | "misses" | "anyway") => {
    if (!check) return;
    setBusy(true);
    setError(null);
    try {
      setSessionId(await start({ checkId: check.checkId, kind }));
      setFinished(null);
      setTab("practice");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (check === undefined) return <p className="m-auto text-muted">Loading…</p>;
  const ready = !!check && check.batchesDone > 0;
  const stage = check?.generatingStage ?? (making ? STAGES[0] : null);
  const activeSession = sessionId ?? null;

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "ideas", label: "Ideas", show: true },
    { id: "practice", label: "Practice", show: !!activeSession },
    { id: "stand", label: "Where you stand", show: ready },
  ];

  return (
    <div className="flex-1">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-7">
        <Link href={pathHref} className="retro">
          ← Path
        </Link>
        <p className="min-w-0 flex-1 truncate font-serif text-ui font-bold max-md:order-3 max-md:basis-full">{title}</p>
        {ready && (
          <nav aria-label="Concept check" className="flex gap-1 rounded-xl bg-panel p-1 max-md:order-4 max-md:w-full max-md:overflow-x-auto">
            {tabs
              .filter((t) => t.show)
              .map((t) => (
                <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)} className={`whitespace-nowrap rounded-lg px-3 py-1 text-meta font-semibold ${tab === t.id ? "bg-card shadow-[0_1px_2px_rgba(42,34,27,.15)]" : "text-muted hover:text-ink"}`}>
                  {t.label}
                </button>
              ))}
          </nav>
        )}
        <div className="ml-auto">
          <XpStats level={false} />
        </div>
      </header>

      {tab === "practice" && activeSession ? (
        <ConceptSession sessionId={activeSession} documentId={documentId} isPdf={isPdf} pageHref={pageHref} pageLabel={pageLabel} onDone={onDone} />
      ) : tab === "stand" && check ? (
        <Standing check={check} finished={finished} pageHref={pageHref} pageLabel={pageLabel} busy={busy} onStart={begin} oldBest={oldBest} />
      ) : (
        <main className="mx-auto max-w-[1040px] px-4 pb-16 pt-3 md:px-7">
          <p className="font-game text-label tracking-wider text-accent-dark">TEST YOURSELF · {eyebrow}</p>
          <h1 className="mt-1 font-serif text-h1 font-bold leading-tight">From remembering to using it</h1>
          <p className="mt-2 max-w-[720px] text-muted">
            {ready ? summary(check.cells, check.ideas.length) : "Check the chapter's key ideas. You'll start with a mix of remembering and using them."}
            {ready && check.nextCount > 0 ? ` Next: ${check.nextCount} questions, about ${Math.max(2, Math.round(check.nextCount * 0.75))} minutes.` : ""}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODE_LIST.map((m, i) => (
              <article key={m} className="rounded-2xl border border-line bg-card p-4" style={{ borderTop: `5px solid ${MODE_INFO[m].colour}` }}>
                <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">Level {i + 1}</p>
                <h2 className="font-serif text-h3 font-bold">{MODE_INFO[m].label}</h2>
                <p className="mt-1 text-meta text-muted">{MODE_INFO[m].about}</p>
                <p className="mt-2 font-serif text-meta italic">“{MODE_INFO[m].example}”</p>
                <p className="mt-2 text-label font-semibold text-good">✓ Open</p>
              </article>
            ))}
          </div>

          {ready ? (
            <section className="mt-5 rounded-2xl border border-line bg-cream p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-h3 font-bold">
                  The {check.ideas.length} key idea{check.ideas.length === 1 ? "" : "s"} in this chapter
                </h2>
                <p className="text-meta text-muted">
                  Based on {check.coverage.pagesUsed} of {check.coverage.pagesTotal} pages
                </p>
              </div>
              <IdeaGrid ideas={check.ideas} cells={check.cells} />
            </section>
          ) : (
            <section className="mt-5 rounded-2xl border border-line bg-cream p-5 text-center">
              {stage ? (
                <div role="status" aria-live="polite">
                  <Bulb size={44} rays />
                  <p className="mt-2 font-bold">{stage}…</p>
                  <ol className="mx-auto mt-3 max-w-[340px] space-y-1 text-left text-meta">
                    {STAGES.map((s, i) => {
                      const at = Math.max(0, STAGES.indexOf(stage));
                      return (
                        <li key={s} className={i <= at ? "font-semibold" : "text-muted"}>
                          {i < at ? "✓" : i === at ? "●" : "○"} {s}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-3 text-meta text-muted">This usually takes under a minute. You can stay on this page.</p>
                </div>
              ) : (
                <>
                  <p className="text-muted">We&apos;ll find the chapter&apos;s key ideas and check every question against its source.</p>
                  <button className="chunky mt-3" onClick={make} disabled={quota !== undefined && quota.left <= 0} autoFocus>
                    <Bulb size={20} /> Make my concept check
                  </button>
                  <p className="mt-3 text-meta text-muted">{quota && quota.left <= 0 ? "You've used today's AI questions. Come back tomorrow." : `Uses 1 of today's AI questions${quota ? ` (${quota.left} left)` : ""}. Practicing is free.`}</p>
                </>
              )}
            </section>
          )}

          {ready && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {check.openSessionId ? (
                <button className="chunky" onClick={() => { setSessionId(check.openSessionId); setTab("practice"); }}>
                  Continue session
                </button>
              ) : check.nextCount > 0 ? (
                <button className="chunky" disabled={busy} onClick={() => begin("today")}>
                  {check.dueNow ? `Review ${check.nextCount} questions` : check.answered ? `Practice ${check.nextCount} questions` : `Start ${check.nextCount} questions`}
                </button>
              ) : (
                <button className="chunky" disabled={busy} onClick={() => begin("anyway")}>
                  Practice anyway
                </button>
              )}
              {check.missCount > 0 && !check.openSessionId && (
                <button className="chunky chunky-light" disabled={busy} onClick={() => begin("misses")}>
                  Practice my misses
                </button>
              )}
              {check.canDeepen && (
                <button className="quiet" disabled={!!stage} onClick={make}>
                  {stage ? `${stage}…` : "Write harder questions"}
                </button>
              )}
              {check.nextCheckAt && !check.dueNow && <span className="text-meta text-muted">Next check {dayLabel(check.nextCheckAt)}</span>}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-ui text-bad">
              {error}{" "}
              <Link href={classicHref} className="underline">
                Take the quick 5-question test
              </Link>
            </p>
          )}
          {oldBest && <p className="mt-4 text-meta text-muted">Quick test best: {oldBest.best}/{oldBest.total}. It&apos;s a separate score.</p>}
          <HowItWorks />
        </main>
      )}
    </div>
  );
}

function summary(cells: Cell[], ideas: number) {
  const checked = new Set(cells.filter((c) => c.status !== "not_checked").map((c) => c.ideaId)).size;
  if (checked === 0) return "Your questions are ready.";
  if (checked < Math.ceil(ideas * 0.75)) return `${checked} of ${ideas} ideas checked so far.`;
  const solid = new Set(cells.filter((c) => c.mode === "remember" && c.status === "solid").map((c) => c.ideaId)).size;
  return solid ? `Reliable recall on ${solid} of ${ideas} ideas.` : `All key ideas are in progress. Come back to make them stick.`;
}

function IdeaGrid({ ideas, cells }: { ideas: { id: string; name: string; objective: string }[]; cells: Cell[] }) {
  const cell = (id: string, m: Mode) => cells.find((c) => c.ideaId === id && c.mode === m)!;
  return (
    <>
      <div className="mt-3 overflow-x-auto max-md:hidden">
        <table className="w-full min-w-[680px] border-separate border-spacing-1.5 text-left">
          <thead>
            <tr>
              <th className="w-[30%] text-label uppercase tracking-[0.08em] text-muted">Idea</th>
              {MODE_LIST.map((m) => (
                <th key={m} className="text-center text-label uppercase tracking-[0.08em] text-muted">
                  {MODE_INFO[m].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ideas.map((i) => (
              <tr key={i.id}>
                <th scope="row" className="pr-2 align-middle text-ui font-semibold" title={i.objective}>
                  {i.name}
                </th>
                {MODE_LIST.map((m) => (
                  <td key={m} title={detail(cell(i.id, m))}>
                    <StatusPill status={cell(i.id, m).status} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 space-y-2 md:hidden">
        {ideas.map((i) => (
          <article key={i.id} className="rounded-xl border border-line bg-card p-3">
            <h3 className="font-semibold">{i.name}</h3>
            <dl className="mt-2 space-y-1">
              {MODE_LIST.map((m) => (
                <div key={m} className="grid grid-cols-[96px_1fr] items-center gap-2 text-meta">
                  <dt>{MODE_INFO[m].label}</dt>
                  <dd><StatusPill status={cell(i.id, m).status} /></dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

const detail = (c: Cell) => (c.total ? `${statusLabel(c.status)} · ${c.right} of ${c.total} recent · ${dayLabel(c.lastAt!)}` : "Not checked yet");

function HowItWorks() {
  return (
    <details className="mt-5 rounded-xl border border-line bg-card px-4 py-3 text-meta">
      <summary className="cursor-pointer font-semibold">How this works</summary>
      <p className="mt-2 text-muted">Solid means consistent success on spaced checks of this idea and level. It isn&apos;t certified mastery. Not checked isn&apos;t a gap, it just means we haven&apos;t asked yet.</p>
      <p className="mt-1 text-muted">The four levels draw on Bloom&apos;s taxonomy and Depth of Knowledge. Every level is open from the start.</p>
    </details>
  );
}

type CheckData = NonNullable<ReturnType<typeof useQuery<typeof api.concepts.get>>>;

function Standing({
  check,
  finished,
  pageHref,
  pageLabel,
  busy,
  onStart,
  oldBest,
}: {
  check: CheckData;
  finished: Id<"conceptSessions"> | null;
  pageHref: (page: number) => string;
  pageLabel: string;
  busy: boolean;
  onStart: (kind: "today" | "misses" | "anyway") => void;
  oldBest: { best: number; total: number } | null;
}) {
  const ideas = check.ideas.length;
  return (
    <main className="mx-auto max-w-[1040px] px-4 pb-16 pt-3 md:px-7">
      {finished && <SessionResult sessionId={finished} pageHref={pageHref} pageLabel={pageLabel} />}
      <p className="font-game text-label tracking-wider text-accent-dark">WHERE YOU STAND</p>
      <h1 className="mt-1 font-serif text-h1 font-bold leading-tight">{summary(check.cells, ideas)}</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODE_LIST.map((m) => {
          const inMode = check.cells.filter((c) => c.mode === m);
          const solid = inMode.filter((c) => c.status === "solid").length;
          const checked = inMode.filter((c) => c.status !== "not_checked").length;
          return (
            <article key={m} className="rounded-2xl border border-line bg-card p-4" style={{ borderTop: `5px solid ${MODE_INFO[m].colour}` }}>
              <h2 className="text-label font-bold uppercase tracking-[0.08em] text-muted">{MODE_INFO[m].label}</h2>
              <p className="mt-1 font-serif text-h2 font-bold">
                {solid} of {ideas}
              </p>
              <p className="text-meta text-muted">ideas solid · {checked} checked</p>
            </article>
          );
        })}
      </div>
      <section className="mt-4 rounded-2xl border border-line bg-cream p-4">
        <h2 className="font-serif text-h3 font-bold">Each idea, level by level</h2>
        <IdeaGrid ideas={check.ideas} cells={check.cells} />
      </section>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-label font-bold uppercase tracking-[0.08em] text-muted">Your confidence</h2>
          <p className="mt-1">{check.sureTotal ? `Correct on ${check.sureRight} of ${check.sureTotal} Sure answers so far.` : "No Sure answers yet."}</p>
          <p className="mt-1 text-meta text-muted">
            Based on {check.coverage.pagesUsed} of {check.coverage.pagesTotal} pages.
          </p>
          {oldBest && <p className="mt-1 text-meta text-muted">Quick test best: {oldBest.best}/{oldBest.total}.</p>}
        </section>
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-label font-bold uppercase tracking-[0.08em] text-muted">Next check</h2>
          <p className="mt-1 font-semibold">{check.nextCheckAt ? (check.dueNow ? "Ready now" : `Come back ${dayLabel(check.nextCheckAt)}`) : "Answer a few questions first"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {check.nextCount > 0 ? (
              <button className="chunky sm" disabled={busy} onClick={() => onStart("today")}>
                {check.dueNow ? "Review now" : "Keep practicing"}
              </button>
            ) : (
              <button className="chunky sm" disabled={busy} onClick={() => onStart("anyway")}>
                Practice anyway
              </button>
            )}
            {check.missCount > 0 && (
              <button className="quiet" disabled={busy} onClick={() => onStart("misses")}>
                Practice my misses
              </button>
            )}
          </div>
        </section>
      </div>
      <HowItWorks />
    </main>
  );
}

function SessionResult({ sessionId, pageHref, pageLabel }: { sessionId: Id<"conceptSessions">; pageHref: (page: number) => string; pageLabel: string }) {
  const r = useQuery(api.concepts.result, { sessionId });
  const save = useMutation(api.concepts.saveMisses);
  const [saved, setSaved] = useState<string | null>(null);
  if (!r) return null;
  return (
    <section className="mb-5 rounded-[18px] border-2 border-ink bg-card p-4 shadow-[0_5px_0_var(--ink)] md:p-5">
      <p className="font-game text-label tracking-wider text-accent-dark">SESSION COMPLETE</p>
      <h2 className="mt-1 font-serif text-h2 font-bold">{r.headlineIdea ? `You used ${r.headlineIdea} correctly in a new situation.` : `You answered ${r.right} of ${r.total} correctly.`}</h2>
      <p className="mt-1 text-muted">
        {r.right} of {r.total} right · <span className="font-semibold text-good">+{r.xp} XP</span>
        {r.nextCheckAt ? ` · Next check ${dayLabel(r.nextCheckAt)}` : ""}
      </p>
      {r.changes.length > 0 && (
        <ul className="mt-3 space-y-1 text-meta">
          {r.changes.map((c) => (
            <li key={`${c.idea}-${c.mode}`}>
              <b>{c.idea}</b> · {MODE_INFO[c.mode].label}: {statusLabel(c.from)} → {statusLabel(c.to)}
            </li>
          ))}
        </ul>
      )}
      {r.confidentMisses.length > 0 && (
        <div className="mt-3 rounded-xl bg-panel p-3 text-meta">
          <p className="font-bold">Worth revisiting</p>
          {r.confidentMisses.map((m, i) => (
            <p key={i} className="mt-1">
              <b>{m.idea}:</b> you felt sure about “{m.yourAnswer}”. The chapter supports “{m.rightAnswer}”.{" "}
              <a className="underline" href={pageHref(m.page)}>
                {pageLabel}
                {m.page}
              </a>
            </p>
          ))}
        </div>
      )}
      {r.misses > 0 && (
        <button className="quiet mt-3" disabled={!!saved} onClick={() => save({ sessionId }).then((x) => setSaved(x.added ? `Saved ${x.added} to Notes` : "Already in Notes")).catch((e) => setSaved(errorMessage(e)))}>
          {saved ?? "📓 Save misses to notes"}
        </button>
      )}
    </section>
  );
}
