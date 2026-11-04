"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/convex/_generated/api";

function CourseList() {
  const courses = useQuery(api.courses.list);
  if (courses === undefined) return <p className="text-muted">Loading…</p>;
  if (courses.length === 0) {
    return (
      <div className="card text-center">
        <p className="font-serif text-xl">No courses yet</p>
        <p className="mt-1 text-muted">Upload a chapter or slide deck to get started.</p>
        <Link href="/courses/new" className="btn-primary mt-4">Upload your first PDF</Link>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {courses.map((c) => (
        <li key={c._id}>
          <Link href={`/courses/${c._id}`} className="card block transition hover:border-accent">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-serif text-xl">{c.title}</h2>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {c.subject && `${c.subject} · `}added {new Date(c._creationTime).toLocaleDateString()}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CoursesPage() {
  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Your courses</h1>
        <Link href="/courses/new" className="btn-primary">+ New course</Link>
      </div>
      <CourseList />
    </AppShell>
  );
}
