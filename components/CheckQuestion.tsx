"use client";

import { useState } from "react";
import { errorMessage } from "./FieldError";

export type Graded = { correct: boolean; answerIndex: number; explanation: string };

// One multiple-choice question. Picking an option submits it; the server grades it and we reveal why.
export function CheckQuestion({
  label,
  question,
  options,
  onAnswer,
  onGraded,
}: {
  label: string;
  question: string;
  options: string[];
  onAnswer: (choice: number) => Promise<Graded>;
  onGraded?: (g: Graded) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(i: number) {
    if (choice !== null) return;
    setChoice(i);
    setError(null);
    try {
      const g = await onAnswer(i);
      setGraded(g);
      onGraded?.(g);
    } catch (err) {
      setChoice(null);
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{label}</p>
      <p className="font-medium leading-relaxed">{question}</p>
      <div className="grid gap-2">
        {options.map((o, i) => {
          const isAnswer = graded?.answerIndex === i;
          const isWrongPick = graded && choice === i && !graded.correct;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={choice !== null}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                isAnswer
                  ? "border-good bg-good/10"
                  : isWrongPick
                    ? "border-bad bg-bad/10"
                    : choice === i
                      ? "border-accent"
                      : "border-line bg-paper hover:border-accent disabled:hover:border-line"
              }`}
            >
              <span className="mr-2 font-semibold text-muted">{"ABCD"[i]}</span>
              {o}
              {isAnswer && <span className="ml-2 text-good">✓</span>}
              {isWrongPick && <span className="ml-2 text-bad">✗</span>}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {graded && (
        <p role="status" className={`rounded-xl p-3 text-sm ${graded.correct ? "bg-good/10" : "bg-bad/10"}`}>
          <span className={`font-semibold ${graded.correct ? "text-good" : "text-bad"}`}>
            {graded.correct ? "Right. " : "Not quite. "}
          </span>
          {graded.explanation}
        </p>
      )}
    </div>
  );
}
