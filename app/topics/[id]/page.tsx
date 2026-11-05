"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LessonVisual } from "@/components/LessonVisual";
import { PillarPath } from "@/components/PillarPath";
import { PracticeSet } from "@/components/practice/PracticeSet";
import { PredictFirst } from "@/components/practice/PredictFirst";
import { StarButton } from "@/components/StarButton";
import { api } from "@/convex/_generated/api";
import { whenLabel } from "@/lib/when";

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LessonDetail({ topicId }: { topicId: string }) {
  const topic = useQuery(api.topics.get, { topicId });
  const ensure = useMutation(api.lessons.ensure);
  const [predicted, setPredicted] = useState(false);

  // Opening a pillar builds its lesson (and the next one) if they don't exist yet.
  useEffect(() => {
    void ensure({ topicId });
  }, [ensure, topicId]);

  if (topic === undefined) return <p className="text-muted">Loading…</p>;
  if (topic === null) {
    return (
      <div className="card text-center">
        <p className="font-serif text-xl">Lesson not found</p>
        <Link href="/courses" className="btn-ghost mt-4">Back to courses</Link>
      </div>
    );
  }

  const next = topic.path.find((p) => p.order === topic.order + 1);
  const lesson = topic.lesson;

  return (
    <article className="space-y-8">
      <div className="space-y-4">
        <Link href={`/courses/${topic.courseId}`} className="text-sm text-muted hover:text-ink">
          ← {topic.courseTitle}
        </Link>
        <PillarPath steps={topic.path} currentId={topic._id} />
      </div>

      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">
          Pillar {topic.order + 1} of {topic.path.length}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl md:text-4xl">{topic.title}</h1>
          <StarButton topicId={topic._id} />
        </div>
        {topic.review && (
          <p className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${topic.review.ingrained ? "bg-good/10 text-good" : "bg-accent-soft text-muted"}`}>
            {topic.review.ingrained
              ? "✦ Ingrained"
              : `Next review ${whenLabel(topic.review.dueAt)} · recalled ${topic.review.successes} of 3`}
          </p>
        )}
        <p className="mt-3 max-w-2xl text-lg leading-relaxed">{lesson?.hook ?? topic.summary}</p>
      </header>

      {topic.lessonStatus === "failed" ? (
        <div role="alert" className="card border-bad/40">
          <p className="font-medium text-bad">We couldn&apos;t build this lesson.</p>
          <p className="mt-1 text-sm text-muted">{topic.lessonError}</p>
          <button className="btn-ghost mt-3" onClick={() => void ensure({ topicId })}>Try again</button>
        </div>
      ) : !lesson || topic.lessonStatus === "generating" ? (
        // Also shown while an old lesson is rebuilt in the new format, so it doesn't swap mid-practice.
        <div className="card animate-pulse space-y-3" aria-live="polite">
          <p className="font-medium">{lesson ? "Upgrading this lesson to the new format…" : "Building this lesson…"}</p>
          <p className="text-sm text-muted">Usually 20–40 seconds. Here&apos;s what it covers:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {topic.subIdeas.map((s, i) => <li key={i}>{s.title}</li>)}
          </ul>
        </div>
      ) : topic.predict && !predicted && topic.progress.answered === 0 ? (
        // First visit: guess before the lesson is shown.
        <PredictFirst topicId={topic._id} q={topic.predict} onDone={() => setPredicted(true)} />
      ) : (
        <>
          {lesson.why && (
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="card border-l-4 border-l-bad/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-bad">The problem</p>
                <p className="mt-2 leading-relaxed">{lesson.why.problem}</p>
              </div>
              <div className="card border-l-4 border-l-good/60">
                <p className="text-xs font-semibold uppercase tracking-wide text-good">The idea</p>
                <p className="mt-2 leading-relaxed">{lesson.why.idea}</p>
              </div>
            </section>
          )}

          <LessonVisual visual={lesson.visual} />

          <section>
            <h2 className="mb-3 font-serif text-2xl">What to take away</h2>
            <ol className="grid gap-3 sm:grid-cols-2">
              {lesson.takeaways.map((t, i) => (
                <li key={i} className="card border-l-4 border-l-accent">
                  <p className="font-medium">{t.title}</p>
                  <p className="mt-1 text-sm leading-relaxed">{t.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {lesson.trap && (
            <section className="rounded-2xl border border-bad/30 bg-bad/5 p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-bad">Common trap</p>
              <p className="mt-2 font-medium">“{lesson.trap.misconception}”</p>
              <p className="mt-1 text-sm leading-relaxed">{lesson.trap.correction}</p>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-serif text-2xl">In the real world</h2>
            {topic.examples.length === 0 ? (
              <p className="text-muted">No well-sourced real-world examples were found for this pillar.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {topic.examples.map((ex, i) => (
                  <div key={i} className="card">
                    <h3 className="font-medium">{ex.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed">{ex.description}</p>
                    <a href={ex.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-block text-sm text-muted underline underline-offset-2 hover:text-ink">
                      Source: {hostname(ex.sourceUrl)} ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <PracticeSet
            topicId={topic._id}
            questions={topic.questions}
            mastered={topic.progress.state === "mastered"}
          />
        </>
      )}

      <footer className="border-t border-line pt-6">
        {next ? (
          <Link href={`/topics/${next._id}`} className="card flex items-center justify-between gap-4 transition hover:border-accent">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next up · Pillar {next.order + 1}</p>
              <p className="mt-1 font-serif text-xl">{next.title}</p>
              <p className="mt-1 text-xs text-muted">
                {next.lessonStatus === "ready" ? "Ready" : next.lessonStatus === "generating" ? "Being built now" : "Builds when you open it"}
              </p>
            </div>
            <span className="text-2xl text-accent" aria-hidden="true">→</span>
          </Link>
        ) : (
          <Link href={`/courses/${topic.courseId}`} className="card flex items-center justify-between gap-4 transition hover:border-accent">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">End of the path</p>
              <p className="mt-1 font-serif text-xl">See your progress report</p>
            </div>
            <span className="text-2xl text-accent" aria-hidden="true">→</span>
          </Link>
        )}
      </footer>
    </article>
  );
}

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <LessonDetail topicId={id} />
    </AppShell>
  );
}
