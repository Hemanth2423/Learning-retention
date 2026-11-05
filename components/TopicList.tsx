"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { NodeState, pathMinutes } from "@/convex/progress";

// How each pillar state looks on the path and the map.
export const NODE: Record<NodeState, { icon: string; label: string; dot: string }> = {
  new: { icon: "", label: "New", dot: "bg-line" },
  learning: { icon: "◐", label: "In progress", dot: "bg-accent" },
  known: { icon: "◆", label: "Known: confirm on Today", dot: "bg-good/50" },
  learned: { icon: "✓", label: "Learned", dot: "bg-good" },
  ingrained: { icon: "✦", label: "Ingrained", dot: "bg-good" },
};

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
  const isDone = (t: (typeof topics)[number]) => t.node !== "new" && t.node !== "learning";
  const mastered = topics.filter(isDone).length;
  const known = topics.filter((t) => t.node === "known").length;
  const minutes = pathMinutes(topics);
  const nextUp = topics.find((t) => !isDone(t));
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Your path</h2>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>
            {mastered} of {topics.length} done
            {minutes > 0 && ` · about ${minutes} min left`}
          </span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${topics.length ? (mastered / topics.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      {thesis && <p className="mb-4 max-w-3xl text-muted"><span className="font-medium text-ink">Big idea:</span> {thesis}</p>}
      {known > 0 && (
        <p className="mb-4 rounded-xl bg-good/10 p-3 text-sm">
          You already know <span className="font-semibold">{known} of {topics.length}</span> ideas. They&apos;re skipped here and come up
          on your Today reviews to confirm.{minutes > 0 && ` Your path is about ${minutes} minutes.`}
        </p>
      )}
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
                  isDone(t) ? "bg-good/15 text-good" : isNext ? "bg-accent text-[#1E2A3A]" : "bg-accent-soft"
                }`}>
                  {NODE[t.node].icon || t.order + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{t.title}</h3>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{t.summary}</p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {isNext ? (
                    <span className="font-semibold text-accent">{t.progress.state === "untested" ? "Start here →" : "Continue →"}</span>
                  ) : t.node !== "new" ? (
                    NODE[t.node].label
                  ) : (
                    STATUS[t.lessonStatus]
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
