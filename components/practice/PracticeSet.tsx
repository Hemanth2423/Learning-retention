"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Done, nextQuestion, SESSION_LENGTH } from "@/convex/questionFlow";
import type { PublicQuestion } from "@/convex/questionRules";
import { QuestionCard } from "./QuestionCard";

// A short adaptive practice round: up to 5 mixed questions. A miss serves an easier one, a hit a harder one.
export function PracticeSet({
  topicId,
  questions,
  mastered,
}: {
  topicId: Id<"topics">;
  questions: PublicQuestion[];
  mastered: boolean;
}) {
  const answer = useMutation(api.checks.answerQuestion);
  const [round, setRound] = useState(mastered ? 0 : 1); // 0 = not started (already mastered)
  const [done, setDone] = useState<Done[]>([]);
  const [current, setCurrent] = useState(() => nextQuestion(questions, [])?.id ?? null);
  const [answered, setAnswered] = useState(false);

  const total = Math.min(SESSION_LENGTH, questions.length);
  const q = questions.find((x) => x.id === current);
  const right = done.filter((d) => d.correct).length;

  function start() {
    setRound(round + 1);
    setDone([]);
    setAnswered(false);
    setCurrent(nextQuestion(questions, [])?.id ?? null);
  }
  function next() {
    setAnswered(false);
    setCurrent(nextQuestion(questions, done)?.id ?? null);
  }

  if (questions.length === 0) return null;

  return (
    <section className="card space-y-4 border-accent/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Practice</h2>
        {round > 0 && (
          <div className="flex gap-1.5" aria-label={`${done.length} of ${total} answered`}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-6 rounded-full ${i < done.length ? (done[i].correct ? "bg-good" : "bg-bad") : i === done.length && q ? "bg-accent" : "bg-line"}`}
              />
            ))}
          </div>
        )}
      </div>

      {round === 0 ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-good/10 p-3 font-medium text-good">✓ Mastered. You applied this idea to a new situation.</p>
          <button className="btn-ghost" onClick={start}>Practice again</button>
        </div>
      ) : q ? (
        <>
          <QuestionCard
            key={`${round}-${q.id}`}
            q={q}
            onSubmit={(a) => answer({ topicId, questionId: q.id, answer: a })}
            onGraded={(g) => {
              setDone([...done, { id: q.id, correct: g.correct }]);
              setAnswered(true);
            }}
          />
          {answered && (
            <button className="btn-primary" onClick={next}>
              {done.length >= total ? "See how you did" : "Continue"}
            </button>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="font-serif text-xl">
            You got {right} of {done.length} right.
          </p>
          {mastered ? (
            <p className="rounded-xl bg-good/10 p-3 font-medium text-good">
              ✓ Mastered. You applied this idea to a new situation. It&apos;ll come back on your Today page
              tomorrow, to make it stick.
            </p>
          ) : (
            <p className="rounded-xl bg-accent-soft p-3 text-sm">
              <span className="font-medium">Not yet, and that&apos;s useful to know.</span> Re-read the takeaways and the
              common trap above, then come back later. Spacing it out helps it stick. This pillar stays on your
              &ldquo;Needs work&rdquo; list until you get a Core or Stretch question right.
            </p>
          )}
          <button className="btn-ghost" onClick={start}>Practice again</button>
        </div>
      )}
    </section>
  );
}
