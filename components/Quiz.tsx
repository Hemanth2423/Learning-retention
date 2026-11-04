"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MASTERY_PCT, pct } from "@/convex/progress";

type Question = { question: string; options: string[] };
type Result = { score: number; total: number; results: { correct: boolean; answerIndex: number; explanation: string }[] };

export function Quiz({ topicId, quiz }: { topicId: Id<"topics">; quiz: Question[] }) {
  const submit = useMutation(api.quizzes.submit);
  const history = useQuery(api.quizzes.historyForTopic, { topicId });
  const [answers, setAnswers] = useState<number[]>(() => quiz.map(() => -1));
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (quiz.length === 0) return null;
  const unanswered = answers.filter((a) => a < 0).length;

  async function onSubmit() {
    if (unanswered > 0) {
      setError(`Answer all questions first — ${unanswered} left.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await submit({ topicId, answers }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setAnswers(quiz.map(() => -1));
    setResult(null);
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">Concept check</h2>
        {history && history.attempts.length > 0 && (
          <p className="text-sm text-muted">
            Best: <span className="font-medium text-ink">{history.best}%</span> · {history.attempts.length} attempt
            {history.attempts.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {result && (
        <div className={`card mb-4 ${pct(result.score, result.total) >= MASTERY_PCT ? "border-good/50" : "border-accent/60"}`}>
          <p className="font-serif text-2xl">
            {result.score} / {result.total} — {pct(result.score, result.total)}%
          </p>
          <p className="mt-1 text-sm text-muted">
            {pct(result.score, result.total) >= MASTERY_PCT
              ? "Mastered. Come back in a few days to make it stick."
              : `Not mastered yet (you need ${MASTERY_PCT}%). Review the key points above and try again.`}
          </p>
          <button className="btn-ghost mt-3" onClick={retake}>Retake quiz</button>
        </div>
      )}

      <ol className="space-y-4">
        {quiz.map((q, qi) => {
          const r = result?.results[qi];
          return (
            <li key={qi} className="card">
              <p className="font-medium">{qi + 1}. {q.question}</p>
              <div className="mt-3 grid gap-2">
                {q.options.map((opt, oi) => {
                  const chosen = answers[qi] === oi;
                  let style = chosen ? "border-ink bg-accent-soft" : "border-line hover:border-muted";
                  if (r) {
                    if (oi === r.answerIndex) style = "border-good bg-good/10";
                    else if (chosen) style = "border-bad bg-bad/10";
                    else style = "border-line opacity-60";
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={!!result}
                      onClick={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${style}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {r && (
                <p className={`mt-3 text-sm ${r.correct ? "text-good" : "text-bad"}`}>
                  {r.correct ? "Correct. " : "Not quite. "}
                  <span className="text-muted">{r.explanation}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" disabled={busy} onClick={onSubmit}>
            {busy ? "Checking…" : "Check my answers"}
          </button>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        </div>
      )}
    </section>
  );
}
