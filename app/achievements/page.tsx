"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";
import { LEVELS, STREAK_MILESTONES } from "@/convex/gamification";

const ICON: Record<string, string> = {
  "pillar-mastered": "✓",
  ingrained: "✦",
  "course-completed": "★",
  comeback: "↺",
  "first-answer": "●",
};
const iconFor = (kind: string) => ICON[kind] ?? (kind.startsWith("streak") ? "🔥" : kind.startsWith("level") ? "▲" : "●");

function Badge({ icon, locked = false }: { icon: string; locked?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 p-1.5 ${locked ? "border-line" : "border-accent"}`}
    >
      <div className={`flex h-full w-full items-center justify-center rounded-full border text-3xl ${locked ? "border-line text-muted opacity-40" : "border-accent/60 bg-accent-soft text-accent"}`}>
        {icon}
      </div>
    </div>
  );
}

function Card({ icon, label, subject, date, locked }: { icon: string; label: string; subject: string; date?: string; locked?: boolean }) {
  return (
    <li className={`card flex flex-col gap-3 text-center ${locked ? "border-dashed" : ""}`}>
      <Badge icon={icon} locked={locked} />
      <div>
        <p className={`font-semibold ${locked ? "text-muted" : ""}`}>{label}:</p>
        <p className={`font-semibold ${locked ? "text-muted" : ""}`}>{subject}</p>
      </div>
      <p className="mt-auto font-mono text-xs text-muted">{date ?? "Locked"}</p>
    </li>
  );
}

function Achievements() {
  const [tz] = useState(() => new Date().getTimezoneOffset());
  const me = useQuery(api.rewards.me, { tzOffsetMinutes: tz });
  if (me === undefined) return <p className="text-muted">Loading…</p>;

  const have = new Set(me.achievements.map((a) => a.kind));
  const nextStreak = STREAK_MILESTONES.find((m) => !have.has(`streak-${m}`));
  const nextLevel = LEVELS.slice(1).find((l) => !have.has(`level-${l.name}`));
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl md:text-4xl">Achievements</h1>
        <p className="mt-2 max-w-2xl text-muted">Earned by thinking hard and coming back, not by cramming.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Level {me.level.index + 1}</p>
          <p className="mt-1 font-serif text-3xl">{me.level.name}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(me.level.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${me.level.progress * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {me.xp} XP{me.level.next ? ` · ${me.level.toNext} XP to ${me.level.next}` : " · top level"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Streak</p>
          <p className="mt-1 font-serif text-3xl">🔥 {me.streak} {me.streak === 1 ? "day" : "days"}</p>
          <p className="mt-2 text-sm text-muted">
            {me.activeToday ? "Kept today." : "Answer one question today to keep it."} Longest: {me.longestStreak}. Freezes: {me.freezes}.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Earned</h2>
        {me.achievements.length === 0 ? (
          <p className="text-muted">Nothing yet. Answer your first question in any lesson.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {me.achievements.map((a) => (
              <Card key={a.id} icon={iconFor(a.kind)} label={a.label} subject={a.subject} date={fmt(a.earnedAt)} />
            ))}
          </ul>
        )}
      </section>

      {(nextStreak || nextLevel) && (
        <section>
          <h2 className="mb-3 font-serif text-2xl">Up next</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {nextStreak && <Card icon="🔥" label="Streak" subject={`${nextStreak} days in a row`} locked />}
            {nextLevel && <Card icon="▲" label="Level Up" subject={nextLevel.name} locked />}
            <Card icon="✦" label="Idea Ingrained" subject="Recall an idea 3 times, a week apart" locked />
          </ul>
        </section>
      )}
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <AppShell>
      <Achievements />
    </AppShell>
  );
}
