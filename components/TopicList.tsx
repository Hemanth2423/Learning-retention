"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { isMastered } from "@/convex/progress";

const STATUS: Record<string, string> = {
  ready: "Ready",
  generating: "Building…",
  pending: "Builds when opened",
  failed: "Needs retry",
};

// The course as a learning path: pillars in the order to learn them, with a clear place to start.
export function TopicList({ courseId, thesis }: { courseId: string; thesis?: string }) {
  const topics = useQuery(api.topics.listByCourse, { courseId });
  if (!topics) return null;
  const mastered = topics.filter((t) => isMastered(t.best)).length;
  const nextUp = topics.find((t) => !isMastered(t.best)) ?? topics[0];
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Your path</h2>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{mastered} of {topics.length} mastered</span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${topics.length ? (mastered / topics.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      {thesis && <p className="mb-4 max-w-3xl text-muted"><span className="font-medium text-ink">Big idea:</span> {thesis}</p>}
      <ol className="space-y-2">
        {topics.map((t) => {
          const isNext = nextUp?._id === t._id;
          return (
            <li key={t._id}>
              <Link
                href={`/topics/${t._id}`}
                className={`card flex items-center gap-4 transition hover:border-accent ${isNext ? "border-accent" : ""}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif font-semibold ${
                  isMastered(t.best) ? "bg-good/15 text-good" : isNext ? "bg-accent text-[#1E2A3A]" : "bg-accent-soft"
                }`}>
                  {isMastered(t.best) ? "✓" : t.order + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{t.title}</h3>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{t.summary}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {isNext ? <span className="font-semibold text-accent">{t.best === null ? "Start here →" : "Continue →"}</span> : STATUS[t.lessonStatus]}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
