"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ScoreChart } from "@/components/ScoreChart";
import { api } from "@/convex/_generated/api";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Dashboard() {
  const s = useQuery(api.dashboard.stats);
  if (s === undefined) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Courses" value={String(s.courseCount)} hint={`${s.topicCount} topics total`} />
        <Stat label="Topics mastered" value={`${s.mastered} / ${s.topicCount}`} hint="Best quiz score ≥ 80%" />
        <Stat label="Average quiz score" value={s.averageScore === null ? "—" : `${s.averageScore}%`} hint={`Across ${s.quizzesTaken} quiz${s.quizzesTaken === 1 ? "" : "zes"}`} />
        <Stat label="Quizzes this week" value={String(s.quizzesThisWeek)} hint="Last 7 days" />
      </div>
      <section className="card">
        <h2 className="font-serif text-xl">Quiz scores over time</h2>
        <p className="mb-4 text-sm text-muted">Each dot is one quiz attempt. Above the dashed line = mastered.</p>
        {s.timeline.length === 0 ? (
          <p className="py-12 text-center text-muted">
            Take your first quiz to see your progress here. <Link href="/courses" className="underline">Go to courses</Link>
          </p>
        ) : (
          <ScoreChart data={s.timeline} />
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl">Dashboard</h1>
      <Dashboard />
    </AppShell>
  );
}
