"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { PublicQuestion } from "@/convex/questionRules";
import { QuestionCard } from "./practice/QuestionCard";

type Placement = {
  status: "generating" | "ready" | "failed" | "skipped" | "done";
  error?: string;
  questions: { topicId: Id<"topics">; question: PublicQuestion }[];
};

// A 1-minute check before the course: one question per pillar. Ideas you already know get skipped
// (and go straight to spaced review to confirm them). Only offered before you've started the course.
export function PlacementCheck({ courseId, placement }: { courseId: Id<"courses">; placement?: Placement }) {
  const topics = useQuery(api.topics.listByCourse, { courseId });
  const build = useMutation(api.placement.build);
  const skip = useMutation(api.placement.skip);
  const answer = useMutation(api.placement.answer);
  const [current, setCurrent] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  if (!topics) return null;
  const started = topics.some((t) => t.progress.answered > 0);
  // Keep showing the last answer after the check completes, until "See my path".
  if (placement?.status === "skipped" || (placement?.status === "done" && !current) || (started && !placement)) return null;

  if (!placement || placement.status === "failed") {
    return (
      <section className="card flex flex-wrap items-center justify-between gap-4 border-accent/50">
        <div className="max-w-xl">
          <p className="font-serif text-2xl">Already know some of this?</p>
          <p className="mt-1 text-sm text-muted">
            Take a 1-minute placement check, one question per idea, and skip what you already know.
          </p>
          {placement?.error && <p className="mt-2 text-sm text-bad">{placement.error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={() => void build({ courseId })}>
            {placement ? "Try again" : "Start placement check"}
          </button>
          <button className="text-sm text-muted underline underline-offset-2 hover:text-ink" onClick={() => void skip({ courseId })}>
            I&apos;m new to this
          </button>
        </div>
      </section>
    );
  }

  if (placement.status === "generating") {
    return (
      <section className="card animate-pulse" aria-live="polite">
        <p className="font-medium">Writing your placement check…</p>
        <p className="mt-1 text-sm text-muted">Usually 10–20 seconds.</p>
      </section>
    );
  }

  // Ready: next unanswered question, or the one just answered (until "Next").
  const result = (id: string) => topics.find((t) => t._id === id)?.placement;
  const pending = placement.questions.filter((x) => !result(x.topicId));
  const item = placement.questions.find((x) => x.topicId === current) ?? pending[0];
  if (!item) return null;
  const n = placement.questions.indexOf(item) + 1;

  return (
    <section className="card space-y-4 border-accent/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Placement check</h2>
        <button className="text-xs text-muted underline underline-offset-2 hover:text-ink" onClick={() => void skip({ courseId })}>
          Skip the rest
        </button>
      </div>
      <QuestionCard
        key={item.topicId}
        q={item.question}
        guess
        dontKnow
        label={`Idea ${n} of ${placement.questions.length} · ${topics.find((t) => t._id === item.topicId)?.title ?? ""}`}
        onSubmit={(a) => {
          setCurrent(item.topicId);
          return answer({ courseId, topicId: item.topicId, choice: a as number });
        }}
        onGraded={() => setAnswered(true)}
      />
      {answered && (
        <button
          className="btn-primary"
          onClick={() => {
            setAnswered(false);
            setCurrent(null);
          }}
        >
          {pending.length > 0 ? "Next" : "See my path"}
        </button>
      )}
    </section>
  );
}
