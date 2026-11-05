"use client";

import { FormEvent, useState } from "react";
import type { Answer, Graded, PublicQuestion } from "@/convex/questionRules";
import { errorMessage } from "../FieldError";

const LABEL: Record<string, string> = {
  apply: "Apply it",
  spot: "Spot the mistake",
  why: "Why is it true?",
  core: "The core idea",
  order: "Put it in order",
  match: "Match them",
  gap: "Fill the gap",
};
const LEVEL: Record<string, string> = { easier: "Warm-up", apply: "Core", stretch: "Stretch" };

// What a graded answer can also carry back: XP earned and anything newly unlocked.
type Result = Graded & { reward?: { xp: number; achievements: string[]; levelUp: string | null } };

// One practice question of any type. The server grades it; then we reveal the answer and why.
// guess: framed as a guess (no level, no "wrong"). label overrides the type label.
// dontKnow: adds an "I don't know yet" option, sent as answer -1.
export function QuestionCard({
  q,
  onSubmit,
  onGraded,
  guess = false,
  label: labelOverride,
  dontKnow = false,
}: {
  q: PublicQuestion;
  onSubmit: (answer: Answer) => Promise<Result>;
  onGraded: (g: Result) => void;
  guess?: boolean;
  label?: string;
  dontKnow?: boolean;
}) {
  const [graded, setGraded] = useState<Result | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(answer: Answer) {
    if (busy || graded) return;
    setBusy(true);
    setError(null);
    try {
      const g = await onSubmit(answer);
      setGraded(g);
      onGraded(g);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const label = labelOverride ?? (guess ? "Before you start: make a guess" : LABEL[q.type === "choice" ? q.style : q.type]);
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className="text-accent">{label}</span>
        {!guess && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-muted">{LEVEL[q.level]}</span>}
      </p>
      {q.type !== "gap" && <p className="font-medium leading-relaxed">{q.prompt}</p>}

      {q.type === "choice" && <Choice options={q.options} graded={graded} busy={busy} onPick={submit} />}
      {q.type === "order" && <Order items={q.items} graded={graded} busy={busy} onCheck={submit} />}
      {q.type === "match" && <Match left={q.left} right={q.right} graded={graded} busy={busy} onCheck={submit} />}
      {q.type === "gap" && <Gap prompt={q.prompt} graded={graded} busy={busy} onCheck={submit} />}
      {dontKnow && !graded && (
        <button
          className="text-sm text-muted underline underline-offset-2 hover:text-ink"
          disabled={busy}
          onClick={() => {
            setSkipped(true);
            void submit(-1);
          }}
        >
          I don&apos;t know yet
        </button>
      )}

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {graded && (
        <p role="status" className={`rounded-xl p-3 text-sm ${guess ? "bg-accent-soft" : graded.correct ? "bg-good/10" : "bg-bad/10"}`}>
          <span className={`font-semibold ${guess ? "text-accent" : graded.correct ? "text-good" : "text-bad"}`}>
            {skipped ? "No problem, that's what the lesson is for. " : guess ? (graded.correct ? "Good instinct. " : "Interesting guess. ") : graded.correct ? "Right. " : "Not quite. "}
          </span>
          {graded.explanation}
          {graded.reward && (
            <span className="ml-2 inline-block rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-paper">+{graded.reward.xp} XP</span>
          )}
        </p>
      )}
      {graded?.reward?.levelUp && (
        <p className="rounded-xl border border-accent bg-accent-soft p-3 text-sm font-medium">▲ Level up! You&apos;re now a {graded.reward.levelUp}.</p>
      )}
      {graded?.reward?.achievements.map((a) => (
        <p key={a} className="rounded-xl border border-good/40 bg-good/10 p-3 text-sm font-medium text-good">🏆 Achievement unlocked · {a}</p>
      ))}
    </div>
  );
}

type Props = { graded: Graded | null; busy: boolean };
const chip = "rounded-xl border px-4 py-3 text-left text-sm transition";
const idle = "border-line bg-paper hover:border-accent disabled:hover:border-line";

function Choice({ options, graded, busy, onPick }: Props & { options: string[]; onPick: (i: number) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  return (
    <div className="grid gap-2">
      {options.map((o, i) => {
        const isAnswer = graded?.solution === i;
        const isWrongPick = graded && choice === i && !graded.correct;
        return (
          <button
            key={i}
            disabled={busy || !!graded}
            onClick={() => {
              setChoice(i);
              onPick(i);
            }}
            className={`${chip} ${isAnswer ? "border-good bg-good/10" : isWrongPick ? "border-bad bg-bad/10" : choice === i ? "border-accent" : idle}`}
          >
            <span className="mr-2 font-semibold text-muted">{"ABCD"[i]}</span>
            {o}
            {isAnswer && <span className="ml-2 text-good">✓</span>}
            {isWrongPick && <span className="ml-2 text-bad">✗</span>}
          </button>
        );
      })}
    </div>
  );
}

// Tap items in the order they happen. Tap a placed item to take it back.
function Order({ items, graded, busy, onCheck }: Props & { items: string[]; onCheck: (order: number[]) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const solution = graded?.solution as number[] | undefined;
  const pool = items.map((_, i) => i).filter((i) => !picked.includes(i));
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {picked.map((i, k) => {
          const mark = solution ? (solution[k] === i ? "✓" : "✗") : null;
          return (
            <li key={i}>
              <button
                disabled={busy || !!graded}
                onClick={() => setPicked((p) => p.filter((x) => x !== i))}
                className={`${chip} flex w-full items-center gap-3 ${mark === "✓" ? "border-good bg-good/10" : mark === "✗" ? "border-bad bg-bad/10" : "border-accent bg-paper"}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-paper">{k + 1}</span>
                <span className="flex-1">{items[i]}</span>
                {mark && <span className={mark === "✓" ? "text-good" : "text-bad"}>{mark}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {pool.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted">{picked.length ? "Next:" : "Tap the first step:"}</p>
          <div className="flex flex-wrap gap-2">
            {pool.map((i) => (
              <button key={i} disabled={busy} onClick={() => setPicked((p) => (p.includes(i) ? p : [...p, i]))} className={`${chip} ${idle} py-2`}>
                {items[i]}
              </button>
            ))}
          </div>
        </div>
      )}
      {!graded && pool.length === 0 && (
        <button className="btn-primary" disabled={busy} onClick={() => onCheck(picked)}>Check order</button>
      )}
      {solution && !graded?.correct && (
        <p className="text-sm text-muted">
          Right order: {solution.map((i, k) => `${k + 1}. ${items[i]}`).join("  ·  ")}
        </p>
      )}
    </div>
  );
}

// Tap a term on the left, then its partner on the right. Tap a paired term to undo.
function Match({ left, right, graded, busy, onCheck }: Props & { left: string[]; right: string[]; onCheck: (map: number[]) => void }) {
  // One state object with functional updates, so quick taps never read a stale selection.
  const [{ map, sel }, setPairs] = useState<{ map: (number | null)[]; sel: number | null }>({
    map: left.map(() => null),
    sel: null,
  });
  const solution = graded?.solution as number[] | undefined;
  const locked = busy || !!graded;

  function tapLeft(i: number) {
    setPairs((s) => ({ map: s.map.map((m, k) => (k === i ? null : m)), sel: i }));
  }
  function tapRight(r: number) {
    setPairs((s) =>
      s.sel === null ? s : { map: s.map.map((m, k) => (k === s.sel ? r : m === r ? null : m)), sel: null }
    );
  }
  const pairNo = (r: number) => map.indexOf(r);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Tap a term, then what it goes with.</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          {left.map((l, i) => {
            const ok = solution ? solution[i] === map[i] : null;
            return (
              <button
                key={i}
                disabled={locked}
                onClick={() => tapLeft(i)}
                className={`${chip} flex w-full items-center gap-2 ${ok === true ? "border-good bg-good/10" : ok === false ? "border-bad bg-bad/10" : sel === i ? "border-accent bg-accent-soft" : idle}`}
              >
                {map[i] !== null && <Badge n={i + 1} />}
                <span className="flex-1 font-medium">{l}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {right.map((r, j) => (
            <button
              key={j}
              disabled={locked}
              onClick={() => tapRight(j)}
              className={`${chip} flex w-full items-center gap-2 ${pairNo(j) >= 0 ? "border-accent bg-paper" : idle}`}
            >
              {pairNo(j) >= 0 && <Badge n={pairNo(j) + 1} />}
              <span className="flex-1">{r}</span>
            </button>
          ))}
        </div>
      </div>
      {!graded && map.every((m) => m !== null) && (
        <button className="btn-primary" disabled={busy} onClick={() => onCheck(map as number[])}>Check matches</button>
      )}
      {solution && !graded?.correct && (
        <ul className="space-y-1 text-sm text-muted">
          {left.map((l, i) => (
            <li key={i}><span className="font-medium text-ink">{l}</span> → {right[solution[i]]}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-paper">{n}</span>;
}

function Gap({ prompt, graded, busy, onCheck }: Props & { prompt: string; onCheck: (typed: string) => void }) {
  const [typed, setTyped] = useState("");
  const [before, after] = prompt.split("___");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (typed.trim()) onCheck(typed);
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="font-medium leading-loose">
        {before}
        <input
          aria-label="Your answer"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy || !!graded}
          maxLength={60}
          autoComplete="off"
          className={`mx-1 inline-block w-44 rounded-lg border-b-2 bg-paper px-2 py-1 text-center ${graded ? (graded.correct ? "border-good" : "border-bad") : "border-accent"}`}
        />
        {after}
      </p>
      {!graded && <button className="btn-primary" disabled={busy || !typed.trim()}>Check</button>}
      {graded && !graded.correct && <p className="text-sm text-muted">Answer: <span className="font-medium text-ink">{graded.solution as string}</span></p>}
    </form>
  );
}
