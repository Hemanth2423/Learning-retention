"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CheckQuestion } from "./CheckQuestion";

type Capstone = {
  status: "generating" | "ready" | "failed";
  error?: string;
  checks: { id: string; question: string; options: string[] }[];
};

// End-of-course questions that need two pillars at once. Built only when someone asks for them.
export function CapstoneChecks({ courseId, capstone }: { courseId: Id<"courses">; capstone?: Capstone }) {
  const build = useMutation(api.checks.buildCapstone);
  const answer = useMutation(api.checks.answerConnect);

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-serif text-2xl">Put it together</h2>
        <p className="mt-1 text-sm text-muted">
          Questions that need more than one pillar at once, the real test of understanding the whole picture.
        </p>
      </div>
      {!capstone || capstone.status === "failed" ? (
        <div className="space-y-2">
          {capstone?.error && <p className="text-sm text-bad">{capstone.error}</p>}
          <button className="btn-primary" onClick={() => void build({ courseId })}>
            {capstone ? "Try again" : "Build my final check"}
          </button>
        </div>
      ) : capstone.status === "generating" ? (
        <p className="animate-pulse text-sm text-muted" aria-live="polite">Writing questions that connect the pillars…</p>
      ) : (
        <ol className="space-y-6">
          {capstone.checks.map((q, i) => (
            <li key={q.id}>
              <CheckQuestion
                label={`Connect ${i + 1} of ${capstone.checks.length}`}
                question={q.question}
                options={q.options}
                onAnswer={(choice) => answer({ courseId, checkId: q.id, choice, tzOffsetMinutes: new Date().getTimezoneOffset() })}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
