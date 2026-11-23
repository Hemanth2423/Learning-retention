"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { Confidence, Mode } from "@/convex/conceptRules";
import { FigurePeek } from "./FigurePeek";
import { MODE_INFO, MODE_LIST } from "./shared";

const KEYS = "ABCD";
const SURE: { id: Confidence; label: string }[] = [
  { id: "sure", label: "Sure" },
  { id: "think", label: "Think so" },
  { id: "guess", label: "Guessing" },
];
const REPORTS = [
  { id: "wrong_answer", label: "The answer is wrong" },
  { id: "ambiguous", label: "More than one answer fits" },
  { id: "unsupported", label: "The book doesn't support it" },
  { id: "broken_source", label: "The source is broken" },
] as const;

export function ConceptSession({
  sessionId,
  documentId,
  isPdf,
  pageHref,
  pageLabel,
  onDone,
}: {
  sessionId: Id<"conceptSessions">;
  documentId: Id<"documents">;
  isPdf: boolean;
  pageHref: (page: number) => string;
  pageLabel: string;
  onDone: () => void;
}) {
  const cur = useQuery(api.concepts.current, { sessionId });
  const answer = useMutation(api.concepts.answer);
  const next = useMutation(api.concepts.next);
  const report = useMutation(api.concepts.report);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const position = cur?.position ?? 0;

  const [shownPosition, setShownPosition] = useState(position);
  if (shownPosition !== position) {
    setShownPosition(position);
    setPicked(null);
    setWhy(false);
    setReporting(false);
    setProblem(null);
  }
  useEffect(() => {
    if (cur?.finished) onDone();
  }, [cur?.finished, onDone]);

  const submit = useCallback(
    async (confidence: Confidence) => {
      if (picked === null || busy) return;
      setBusy(true);
      setProblem(null);
      try {
        await answer({ sessionId, position, option: picked, confidence });
      } catch (err) {
        setProblem(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [answer, busy, picked, position, sessionId]
  );
  const advance = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await next({ sessionId, position });
      if (res.finished) onDone();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [busy, next, onDone, position, sessionId]);

  const question = cur && !cur.finished ? cur.question : null;
  const feedback = cur && !cur.finished ? cur.feedback : null;
  useEffect(() => {
    if (!question) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input,textarea")) return;
      if (feedback) {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") void advance();
        return;
      }
      const i = KEYS.indexOf(e.key.toUpperCase());
      if (i >= 0 && i < question.options.length) setPicked(question.options[i].id);
      if (picked !== null && ["1", "2", "3"].includes(e.key)) void submit(SURE[Number(e.key) - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, feedback, picked, question, submit]);

  if (cur === undefined) return <p className="m-auto py-20 text-center text-muted">Loading…</p>;
  if (!cur || cur.finished || !question) return <p className="m-auto py-20 text-center text-muted">Finishing…</p>;
  const info = MODE_INFO[question.mode as Mode];
  const reported = !question.active;
  const optionStyle = (id: number) => {
    if (feedback) {
      if (id === feedback.answer) return "border-good bg-good-soft";
      if (id === feedback.chosen) return "border-bad bg-accent-soft";
      return "border-line opacity-70";
    }
    return id === picked ? "border-accent bg-accent-soft" : "border-[#c9b9a0] bg-white hover:border-ink";
  };

  return (
    <div className="mx-auto grid w-full max-w-[1040px] gap-5 px-4 pb-16 pt-3 md:grid-cols-[minmax(0,1fr)_260px] md:px-7">
      <div className="min-w-0">
        <div className="mb-3 flex gap-1.5" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={cur.total} aria-valuenow={cur.done.filter(Boolean).length}>
          {cur.done.map((d, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full border border-ink ${i === position ? "bg-ochre" : d ? "bg-good" : "bg-card"}`} />
          ))}
        </div>
        <section className="rounded-[18px] border-2 border-ink bg-card p-4 shadow-[0_5px_0_var(--ink)] md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-meta">
            <span className="inline-flex items-center gap-2 rounded-full bg-panel px-2.5 py-1 font-semibold">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: info.colour }} />
              {info.label} · {info.challenge}
            </span>
            <span className="text-muted">
              Question {position + 1} of {cur.total}
            </span>
          </div>
          <h2 className="mt-3 font-serif text-h2 font-bold leading-snug">{question.text}</h2>
          {question.code && <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 font-mono text-meta text-[#f6eedf]"><code>{question.code}</code></pre>}

          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Answer options">
            {question.options.map((o, i) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={feedback ? feedback.chosen === o.id : picked === o.id}
                disabled={!!feedback || busy}
                onClick={() => setPicked(o.id)}
                className={`flex w-full items-start gap-3 rounded-xl border-[1.5px] px-3 py-2.5 text-left text-ui transition ${optionStyle(o.id)}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-ink bg-card text-label font-bold">{KEYS[i]}</span>
                <span className="min-w-0 flex-1">{o.text}</span>
                {feedback && o.id === feedback.answer && <span className="text-meta font-bold text-good">Correct</span>}
                {feedback && o.id === feedback.chosen && !feedback.correct && <span className="text-meta font-bold text-bad">Your answer</span>}
              </button>
            ))}
          </div>

          {!feedback && (
            <div className="mt-4">
              <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">How sure are you?</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {SURE.map((s) => (
                  <button key={s.id} type="button" className="chunky chunky-light sm" disabled={picked === null || busy} onClick={() => submit(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-meta text-muted">{picked === null ? "Choose an answer first." : "Tapping one submits your answer."}</p>
            </div>
          )}

          {feedback && (
            <div className={`mt-4 rounded-xl border p-3.5 ${feedback.correct ? "border-good-line bg-good-soft/60" : "border-[#e0b6a1] bg-accent-soft/60"}`} role="status">
              <p className="font-bold">
                {feedback.correct ? (feedback.confidence === "guess" ? "Right, even on a guess." : "Right.") : "Not quite."} <span className="font-normal text-muted">Idea: {feedback.ideaName}</span>
              </p>
              <p className="mt-1 text-ui">{feedback.explanation}</p>
              {!feedback.correct && feedback.whyWrong && (
                <>
                  <button type="button" className="mt-2 text-meta font-semibold text-accent-dark underline" aria-expanded={why} onClick={() => setWhy(!why)}>
                    Why was my answer tempting?
                  </button>
                  {why && <p className="mt-1 text-ui">{feedback.whyWrong}</p>}
                </>
              )}
              <blockquote className="mt-3 border-l-[3px] border-accent pl-3 font-serif text-ui italic">“{feedback.excerpt}”</blockquote>
              <a href={pageHref(feedback.page)} className="mt-1 inline-block text-meta font-semibold text-accent-dark underline">
                From {pageLabel}
                {feedback.page}
              </a>
              {feedback.figure && isPdf && <FigurePeek documentId={documentId} page={feedback.page} label={feedback.figure} />}
            </div>
          )}

          {problem && (
            <p role="alert" className="mt-3 text-meta font-semibold text-bad">
              {problem}
            </p>
          )}

          {(feedback || reported) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {reported ? (
                <span className="text-meta text-muted">Thanks. This question won&apos;t count or come back.</span>
              ) : (
                <button type="button" className="text-meta text-muted underline" aria-expanded={reporting} onClick={() => setReporting(!reporting)}>
                  Report a problem
                </button>
              )}
              <button type="button" className="chunky" onClick={advance} disabled={busy} autoFocus>
                {position + 1 >= cur.total ? "See results" : "Next"}
              </button>
            </div>
          )}
          {!feedback && !reported && (
            <button type="button" className="mt-3 text-meta text-muted underline" aria-expanded={reporting} onClick={() => setReporting(!reporting)}>
              Report a problem
            </button>
          )}
          {reporting && !reported && (
            <div className="mt-2 flex flex-wrap gap-2">
              {REPORTS.map((r) => (
                <button key={r.id} type="button" className="quiet" onClick={() => report({ questionId: question.id, reason: r.id }).catch((e) => setProblem(errorMessage(e)))}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-3 max-md:hidden">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">This session</p>
          <ul className="mt-2 space-y-2">
            {MODE_LIST.map((m) => {
              const total = cur.modes.filter((x) => x === m).length;
              const done = cur.modes.filter((x, i) => x === m && cur.done[i]).length;
              return (
                <li key={m} className="grid grid-cols-[84px_1fr_32px] items-center gap-2 text-meta">
                  <span>{MODE_INFO[m].label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-panel">
                    <span className="block h-full rounded-full" style={{ width: total ? `${(done / total) * 100}%` : 0, background: MODE_INFO[m].colour }} />
                  </span>
                  <span className="text-right text-muted">
                    {done}/{total}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">Why a confidence tap?</p>
          <p className="mt-2 text-meta text-muted">It shows where you think you know something but don&apos;t. Mistakes you felt sure about come back first.</p>
        </div>
      </aside>
    </div>
  );
}
