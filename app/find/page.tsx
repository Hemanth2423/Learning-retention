"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/convex/_generated/api";

type Mastery = "all" | "mastered" | "notMastered" | "untested";
type Sort = "newest" | "oldest" | "scoreHigh" | "scoreLow" | "az";

function FindTopics() {
  const [text, setText] = useState("");
  const [courseId, setCourseId] = useState("");
  const [mastery, setMastery] = useState<Mastery>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const data = useQuery(api.topics.find, { text, courseId: courseId || undefined, mastery, sort });

  return (
    <div className="space-y-6">
      <div className="card grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" className="input" placeholder="Search topics, key points, or courses…" value={text}
            onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="course">Course</label>
          <select id="course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">All courses</option>
            {data?.courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="mastery">Progress</label>
          <select id="mastery" className="input" value={mastery} onChange={(e) => setMastery(e.target.value as Mastery)}>
            <option value="all">All pillars</option>
            <option value="mastered">Mastered</option>
            <option value="notMastered">Needs work</option>
            <option value="untested">Not tested yet</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="sort">Sort by</label>
          <select id="sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="scoreHigh">Highest quiz score</option>
            <option value="scoreLow">Lowest quiz score</option>
            <option value="az">A → Z</option>
          </select>
        </div>
      </div>

      {data === undefined ? (
        <p className="text-muted">Loading…</p>
      ) : data.rows.length === 0 ? (
        <p className="card text-center text-muted">No topics match. Try a different word or clear the filters.</p>
      ) : (
        <>
          <p className="text-sm text-muted">{data.rows.length} pillar{data.rows.length === 1 ? "" : "s"}</p>
          <ul className="space-y-3">
            {data.rows.map((t) => (
              <li key={t._id}>
                <Link href={`/topics/${t._id}`} className="card flex items-start justify-between gap-4 transition hover:border-accent">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">{t.courseTitle}</p>
                    <h2 className="mt-0.5 font-medium">{t.starred && <span className="text-accent">★ </span>}{t.title}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{t.summary}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.progress.state === "untested" ? "text-muted" : t.progress.state === "mastered" ? "bg-good/15 text-good" : "bg-accent-soft"}`}>
                    {t.progress.state === "untested" ? "Not tested" : t.progress.state === "mastered" ? "Mastered" : `${t.progress.score}% right`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function FindPage() {
  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl">Find topics</h1>
      <FindTopics />
    </AppShell>
  );
}
