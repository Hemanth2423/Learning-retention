"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Quiz } from "@/components/Quiz";
import { api } from "@/convex/_generated/api";

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function TopicDetail({ topicId }: { topicId: string }) {
  const topic = useQuery(api.topics.get, { topicId });
  if (topic === undefined) return <p className="text-muted">Loading…</p>;
  if (topic === null) {
    return (
      <div className="card text-center">
        <p className="font-serif text-xl">Topic not found</p>
        <Link href="/courses" className="btn-ghost mt-4">Back to courses</Link>
      </div>
    );
  }

  return (
    <article className="space-y-8">
      <Link href={`/courses/${topic.courseId}`} className="text-sm text-muted hover:text-ink">
        ← {topic.courseTitle}
      </Link>
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Topic {topic.order + 1}</p>
        <h1 className="mt-1 font-serif text-3xl">{topic.title}</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed">{topic.summary}</p>
      </header>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Key points</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {topic.keyPoints.map((p, i) => (
            <li key={i} className="card flex gap-3 border-l-4 border-l-accent">
              <span className="font-serif text-2xl font-semibold text-accent">{i + 1}</span>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">In the real world</h2>
        {topic.examples.length === 0 ? (
          <p className="text-muted">No well-sourced real-world examples were found for this topic.</p>
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

      <Quiz key={topic._id} topicId={topic._id} quiz={topic.quiz} />
    </article>
  );
}

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <TopicDetail topicId={id} />
    </AppShell>
  );
}
