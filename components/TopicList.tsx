"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { isMastered } from "@/convex/progress";

export function TopicList({ courseId }: { courseId: string }) {
  const topics = useQuery(api.topics.listByCourse, { courseId });
  if (!topics) return null;
  const mastered = topics.filter((t) => isMastered(t.best)).length;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Key topics</h2>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{mastered} of {topics.length} mastered</span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${topics.length ? (mastered / topics.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {topics.map((t, i) => (
          <li key={t._id}>
            <Link href={`/topics/${t._id}`} className="card flex h-full gap-4 transition hover:border-accent">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif font-semibold">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{t.title}</h3>
                  {t.best === null ? (
                    <span className="shrink-0 text-xs text-muted">Not tested</span>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isMastered(t.best) ? "bg-good/15 text-good" : "bg-accent-soft"}`}>
                      {isMastered(t.best) ? "Mastered" : "Best"} {t.best}%
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{t.summary}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
