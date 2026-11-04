"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CheckQuestion, Graded } from "./CheckQuestion";

type Q = { id: string; level: string; question: string; options: string[] };
type Step = "apply" | "easier" | "stretch" | "mastered" | "review";

const LABEL: Record<string, string> = {
  apply: "Check · apply it",
  easier: "Let's step back · the core idea",
  stretch: "One more · a trickier case",
};

// The fixed question rules (no AI judgment at answer time):
//   1. Start with the "apply" scenario.  Right → mastered (optional harder one).
//   2. Wrong → explanation, then the "easier" direct question.
//   3. Then the "stretch" scenario as a second chance. Right → mastered; wrong → on the review list.
export function PillarChecks({
  topicId,
  checks,
  mastered,
  answered,
}: {
  topicId: Id<"topics">;
  checks: Q[];
  mastered: boolean;
  answered: number;
}) {
  const answer = useMutation(api.checks.answerPillar);
  const [step, setStep] = useState<Step>(mastered ? "mastered" : "apply");
  const [pending, setPending] = useState<Step | null>(null); // where "Continue" goes after a reveal
  const byLevel = (l: string) => checks.find((c) => c.level === l);
  const q = step === "apply" || step === "easier" || step === "stretch" ? byLevel(step) : undefined;

  function graded(g: Graded) {
    if (step === "apply") setPending(g.correct ? "mastered" : "easier");
    if (step === "easier") setPending(byLevel("stretch") ? "stretch" : "review");
    if (step === "stretch") setPending(g.correct ? "mastered" : mastered ? "mastered" : "review");
  }

  if (checks.length === 0) return null;

  return (
    <section className="card space-y-4 border-accent/50">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-2xl">Check your understanding</h2>
        {!mastered && answered > 0 && step === "apply" && (
          <span className="text-xs text-muted">You missed this one before. Give it another go.</span>
        )}
      </div>

      {q && (
        <>
          <CheckQuestion
            key={q.id + step}
            label={LABEL[q.level]}
            question={q.question}
            options={q.options}
            onAnswer={(choice) => answer({ topicId, checkId: q.id, choice })}
            onGraded={graded}
          />
          {pending && (
            <button
              className="btn-primary"
              onClick={() => {
                setStep(pending);
                setPending(null);
              }}
            >
              Continue
            </button>
          )}
        </>
      )}

      {step === "mastered" && (
        <div className="space-y-3">
          <p className="rounded-xl bg-good/10 p-3 font-medium text-good">✓ Mastered. You applied this idea to a new situation.</p>
          {byLevel("stretch") && (
            <button className="btn-ghost" onClick={() => setStep("stretch")}>Try a trickier case</button>
          )}
        </div>
      )}

      {step === "review" && (
        <div className="space-y-3">
          <p className="rounded-xl bg-accent-soft p-3 text-sm">
            <span className="font-medium">Not yet, and that&apos;s useful to know.</span> Re-read the takeaways and
            the common trap above, then come back later. Spacing it out helps it stick. This pillar stays on your
            &ldquo;Needs work&rdquo; list until you get a scenario right.
          </p>
          <button className="btn-ghost" onClick={() => setStep("apply")}>Try the first question again</button>
        </div>
      )}
    </section>
  );
}
