"use client";

import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

// Honest report: only answered scenario questions count as "learned". Reading a lesson doesn't.
export function ProgressReport({ course }: { course: Omit<Doc<"courses">, "capstone"> }) {
  const topics = useQuery(api.topics.listByCourse, { courseId: course._id });
  const suggest = useAction(api.nextSteps.suggest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!topics || topics.length === 0) return null;

  const mastered = topics.filter((t) => t.progress.state === "mastered");
  const weak = topics.filter((t) => t.progress.state === "learning");
  const untested = topics.filter((t) => t.progress.state === "untested");

  let verdict: string;
  if (mastered.length === topics.length) verdict = "You've proven every pillar in this course. Time to go further.";
  else if (mastered.length === 0 && weak.length === 0) verdict = "You haven't checked yourself yet, so we can't say you've learned anything here. Answer a pillar's questions to find out.";
  else verdict = `You've proven ${mastered.length} of ${topics.length} pillars. Pillars you only read don't count as learned.`;

  async function onSuggest() {
    setBusy(true);
    setError(null);
    try {
      await suggest({ courseId: course._id });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const group = (title: string, items: typeof topics, tone: string, empty: string) => (
    <div>
      <h3 className={`text-sm font-medium ${tone}`}>{title} ({items.length})</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {items.map((t) => (
            <li key={t._id}>
              <Link href={`/topics/${t._id}`} className="hover:underline">
                {t.title}
                {t.progress.answered > 0 && (
                  <span className="text-muted"> · {t.progress.correct}/{t.progress.answered} right</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="font-serif text-2xl">What you&apos;ve actually learned</h2>
        <p className="mt-1">{verdict}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {group("Mastered", mastered, "text-good", "None yet. Get a scenario question right to master a pillar.")}
        {group("Needs work", weak, "text-bad", "Nothing flagged.")}
        {group("Not tested", untested, "text-muted", "You've tested everything.")}
      </div>

      <div className="border-t border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl">Next steps</h3>
          <button className="btn-ghost" disabled={busy} onClick={onSuggest}>
            {busy ? "Finding resources…" : course.nextSteps?.length ? "Refresh suggestions" : "Suggest what to learn next"}
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
        {course.nextSteps && course.nextSteps.length > 0 ? (
          <ol className="mt-3 space-y-3">
            {course.nextSteps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold">{i + 1}</span>
                <div>
                  <p className="font-medium">{s.concept}</p>
                  <p className="text-sm text-muted">{s.why}</p>
                  <a href={s.resourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-2">
                    {s.resourceTitle} ↗
                  </a>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">Based on your answers, we&apos;ll suggest what to learn next, with real resources from the web.</p>
        )}
      </div>
    </section>
  );
}
