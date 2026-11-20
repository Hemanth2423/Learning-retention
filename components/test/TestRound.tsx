"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { Bulb } from "@/components/icons/Bulb";
import { XpStats } from "@/components/XpStats";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { PublicQuizQuestion } from "@/convex/quizRules";

const HEARTS = 3;
const KEYS = "ABCD";

type Feedback = { correct: boolean; answer: number; explanation: string; whyWrong: string; page?: number; finished: boolean; score: number; missed: number; xp: number };
export type RoundResult = { score: number; total: number; missed: number; xp: number };

// One round of questions: a full test, or only the missed ones. Every answer is graded on the server.
export function TestRound({
  attemptId,
  questions,
  onLeave,
  onDone,
  pageHref,
}: {
  attemptId: Id<"quizAttempts">;
  questions: PublicQuizQuestion[]; // in the order asked
  onLeave: () => void;
  onDone: (result: RoundResult) => void;
  pageHref: (page: number) => string;
}) {
  const answer = useMutation(api.quizzes.answer);
  const saveQuestion = useMutation(api.notebook.saveQuestion);
  const [savedAt, setSavedAt] = useState<number | null>(null); // the position saved to notes, if any
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hearts, setHearts] = useState(HEARTS);
  const [gained, setGained] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const q = questions[pos];
  const last = pos === questions.length - 1;

  const pick = useCallback(
    async (i: number) => {
      if (chosen !== null) return;
      setChosen(i);
      setError(null);
      try {
        const fb = await answer({ attemptId, position: pos, choice: i });
        setFeedback(fb);
        setGained((g) => g + fb.xp);
        if (!fb.correct) setHearts((h) => Math.max(0, h - 1));
      } catch {
        setChosen(null);
        setError("That answer didn't go through. Try again.");
      }
    },
    [answer, attemptId, chosen, pos]
  );

  const next = useCallback(() => {
    if (!feedback) return;
    if (feedback.finished) return onDone({ score: feedback.score, total: questions.length, missed: feedback.missed, xp: gained });
    setPos((p) => p + 1);
    setChosen(null);
    setFeedback(null);
  }, [feedback, gained, onDone, questions.length]);

  // Keyboard: A–D or 1–4 to answer, Enter for the next question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter" && feedback) {
        e.preventDefault();
        next();
        return;
      }
      const k = e.key.toUpperCase();
      const i = KEYS.indexOf(k) >= 0 ? KEYS.indexOf(k) : "1234".indexOf(k);
      if (i >= 0 && i < q.options.length && chosen === null) void pick(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, feedback, next, pick, q.options.length]);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-20 pt-6">
      <div className="flex items-center gap-3.5">
        <button onClick={onLeave} className="retro" aria-label="Leave the test" title="Leave the test">
          ✕
        </button>
        <div className="flex flex-1 gap-1.5" aria-label={`Question ${pos + 1} of ${questions.length}`}>
          {questions.map((_, i) => (
            <i key={i} className={`h-3 flex-1 rounded border-2 border-ink ${i < pos || (i === pos && feedback) ? "bg-good" : i === pos ? "bg-ochre" : "bg-card"}`} />
          ))}
        </div>
        <span className="text-h2 tracking-[2px]" aria-label={`${hearts} of ${HEARTS} hearts left`} title="Hearts: you lose one for each wrong answer">
          {"❤️".repeat(hearts)}
          {"🤍".repeat(HEARTS - hearts)}
        </span>
        <XpStats level={false} />
      </div>

      <div className="mt-6 rounded-[18px] border-2 border-ink bg-card p-6" style={{ boxShadow: "0 6px 0 var(--ink)" }}>
        <p className="flex items-center gap-2 font-game text-label text-accent-dark">
          <Bulb size={16} /> QUESTION {pos + 1} OF {questions.length}
        </p>
        <h2 className="mb-5 mt-2 font-serif text-h2 leading-snug">{q.question}</h2>
        <div className="grid gap-2.5" role="group" aria-label="Answers">
          {q.options.map((o, i) => {
            const isRight = feedback && i === feedback.answer;
            const isWrong = feedback && i === chosen && !feedback.correct;
            const tone = isRight ? "border-good bg-good-soft" : isWrong ? "border-accent bg-accent-soft" : "border-ink bg-card hover:bg-panel";
            const key = isRight ? "border-good bg-good text-white" : isWrong ? "border-accent bg-accent text-white" : "border-ink";
            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={chosen !== null}
                aria-pressed={chosen === i}
                className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left text-ui disabled:cursor-default ${tone} ${chosen === i && !feedback ? "opacity-70" : ""}`}
                style={{ boxShadow: "0 3px 0 var(--ink)" }}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 font-game text-label ${key}`}>{KEYS[i]}</span>
                {o}
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-ui text-bad">
            {error}
          </p>
        )}
        {feedback && (
          <div role="status" className={`mt-5 rounded-[14px] border-2 border-ink px-4 py-3.5 ${feedback.correct ? "bg-good-soft" : "bg-accent-soft"}`}>
            <b className="mb-1 block text-ui">{feedback.correct ? "Nice! That's right." : "Not quite."}</b>
            {!feedback.correct && feedback.whyWrong && <p className="mb-1.5">{feedback.whyWrong}</p>}
            <p>
              {feedback.explanation}
              {feedback.page !== undefined && (
                <>
                  {" "}
                  <a
                    href={pageHref(feedback.page)}
                    target="_blank"
                    rel="noreferrer"
                    className="whitespace-nowrap rounded bg-ochre/25 px-1.5 py-0.5 text-ui font-semibold underline-offset-2 hover:bg-ochre/45 hover:underline"
                    title="Open this page in the book (new tab, so your test stays here)"
                  >
                    p.{feedback.page} ↗
                  </a>
                </>
              )}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="font-game text-ui text-[#2f4a2b]">{feedback.xp > 0 ? `+${feedback.xp} XP` : ""}</span>
              {!feedback.correct && (
                // Results never go in by themselves: the reader chooses which questions to keep.
                <button
                  className="quiet ml-auto"
                  disabled={saving || savedAt === pos}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await saveQuestion({ attemptId, position: pos });
                      setSavedAt(pos);
                    } catch {
                      setError("We couldn't save that question. Try again.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  title="Keeps the question, your answer and the right one in this chapter's Notebook"
                >
                  {savedAt === pos ? "✓ Saved to notes" : "📓 Save to notes"}
                </button>
              )}
              <button onClick={next} className="chunky" autoFocus>
                {last ? "Finish ›" : "Next ›"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
