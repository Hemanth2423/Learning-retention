"use client";

import { useMutation, useQuery } from "convex/react";
import { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QuestionCard } from "@/components/practice/QuestionCard";
import { api } from "@/convex/_generated/api";
import { whenLabel } from "@/lib/when";

type Item = FunctionReturnType<typeof api.reviews.today>["items"][number];
type Result = { title: string; correct: boolean; justIngrained: boolean };

const tz = () => new Date().getTimezoneOffset();

function Today() {
  const [offset] = useState(tz);
  const data = useQuery(api.reviews.today, { tzOffsetMinutes: offset });
  const answer = useMutation(api.reviews.answer);
  // The session is a snapshot: answering moves a review's due date, which would otherwise reshuffle the list.
  const [session, setSession] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [answered, setAnswered] = useState(false);

  if (data === undefined) return <p className="text-muted">Loading…</p>;

  const header = (
    <header className="mb-6">
      <h1 className="font-serif text-3xl md:text-4xl">Today</h1>
      <p className="mt-2 max-w-2xl text-muted">
        A few minutes of mixed questions on ideas you&apos;ve learned, timed for just before you&apos;d forget them.
      </p>
    </header>
  );

  // In a session
  if (session && i < session.length) {
    const item = session[i];
    return (
      <div>
        {header}
        <section className="card space-y-4 border-accent/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {item.courseTitle} · <span className="font-medium text-ink">{item.topicTitle}</span>
            </p>
            <div className="flex gap-1.5" aria-label={`${i} of ${session.length} done`}>
              {session.map((_, k) => (
                <span key={k} className={`h-2 w-6 rounded-full ${k < results.length ? (results[k].correct ? "bg-good" : "bg-bad") : k === i ? "bg-accent" : "bg-line"}`} />
              ))}
            </div>
          </div>
          <QuestionCard
            key={item.topicId}
            q={item.question}
            onSubmit={(a) => answer({ topicId: item.topicId, questionId: item.question.id, answer: a, tzOffsetMinutes: offset })}
            onGraded={(g) => {
              const r = g as typeof g & { justIngrained?: boolean };
              setResults([...results, { title: item.topicTitle, correct: g.correct, justIngrained: !!r.justIngrained }]);
              setAnswered(true);
            }}
          />
          {answered && (
            <button className="btn-primary" onClick={() => { setAnswered(false); setI(i + 1); }}>
              {i + 1 < session.length ? "Next" : "Finish"}
            </button>
          )}
        </section>
      </div>
    );
  }

  // Just finished
  if (session) {
    const right = results.filter((r) => r.correct).length;
    return (
      <div>
        {header}
        <section className="card space-y-4">
          <p className="font-serif text-2xl">You recalled {right} of {results.length}.</p>
          {results.filter((r) => r.justIngrained).map((r) => (
            <p key={r.title} className="rounded-xl bg-good/10 p-3 font-medium text-good">✦ Ingrained: {r.title}. You&apos;ve remembered it across weeks.</p>
          ))}
          {right < results.length && (
            <p className="text-sm text-muted">The ones you missed come back tomorrow. Missing and then recalling is how memory gets stronger.</p>
          )}
          <NextUp data={data} />
          <button className="btn-ghost" onClick={() => { setSession(null); setI(0); setResults([]); }}>Done</button>
        </section>
      </div>
    );
  }

  return (
    <div>
      {header}
      {data.scheduledCount === 0 ? (
        <section className="card space-y-3">
          <p className="font-medium">Nothing to review yet.</p>
          <p className="text-sm text-muted">When you master a pillar in a lesson, its first review shows up here the next day.</p>
          <Link href="/courses" className="btn-primary">Go to your courses</Link>
        </section>
      ) : data.items.length === 0 ? (
        <section className="card space-y-3">
          <p className="font-serif text-2xl">✓ All caught up for today.</p>
          <NextUp data={data} />
        </section>
      ) : (
        <section className="card flex flex-wrap items-center justify-between gap-4 border-accent/50">
          <div>
            <p className="font-serif text-2xl">{data.dueCount} {data.dueCount === 1 ? "idea" : "ideas"} to review</p>
            <p className="mt-1 text-sm text-muted">
              About {data.items.length} minute{data.items.length === 1 ? "" : "s"}
              {data.dueCount > data.items.length && `, ${data.items.length} at a time`}. Mixed across your courses.
            </p>
          </div>
          <button className="btn-primary" onClick={() => setSession(data.items)}>Start review</button>
        </section>
      )}
      {data.scheduledCount > 0 && (
        <p className="mt-4 text-sm text-muted">
          ✦ {data.ingrainedCount} of {data.scheduledCount} learned {data.scheduledCount === 1 ? "idea" : "ideas"} ingrained
          (recalled 3 times on different days, at least once after a week).
        </p>
      )}
    </div>
  );
}

// The future tag: say what's coming and when, so the brain flags it as worth keeping.
function NextUp({ data }: { data: FunctionReturnType<typeof api.reviews.today> }) {
  if (data.dueCount > 0) return <p className="text-sm">{data.dueCount} more {data.dueCount === 1 ? "is" : "are"} due today.</p>;
  if (data.tomorrowCount > 0) return <p className="text-sm">Tomorrow: {data.tomorrowCount} {data.tomorrowCount === 1 ? "review" : "reviews"}. Sleep on it, that&apos;s when memories set.</p>;
  if (data.nextDueAt) return <p className="text-sm">Next review {whenLabel(data.nextDueAt)}.</p>;
  return null;
}

export default function TodayPage() {
  return (
    <AppShell>
      <Today />
    </AppShell>
  );
}
