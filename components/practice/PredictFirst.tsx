"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { PublicQuestion } from "@/convex/questionRules";
import { QuestionCard } from "./QuestionCard";

// Pretesting: one guess before the lesson. Guessing, even wrong, makes the lesson stick better.
// Not scored. onDone reveals the lesson.
export function PredictFirst({ topicId, q, onDone }: { topicId: Id<"topics">; q: PublicQuestion; onDone: () => void }) {
  const answer = useMutation(api.checks.answerPredict);
  const [answered, setAnswered] = useState(false);
  return (
    <section className="card space-y-4 border-accent/50">
      <QuestionCard
        q={q}
        guess
        onSubmit={(a) => answer({ topicId, choice: a as number })}
        onGraded={() => setAnswered(true)}
      />
      <div className="flex flex-wrap items-center gap-3">
        {answered ? (
          <button className="btn-primary" onClick={onDone}>Start the lesson</button>
        ) : (
          <>
            <p className="text-xs text-muted">It&apos;s not scored. A guess, even a wrong one, helps the lesson stick.</p>
            <button className="text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={onDone}>Skip</button>
          </>
        )}
      </div>
    </section>
  );
}
