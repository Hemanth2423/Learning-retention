"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StarButton } from "@/components/StarButton";
import { api } from "@/convex/_generated/api";

function StarredList() {
  const starred = useQuery(api.stars.listMine);
  if (starred === undefined) return <p className="text-muted">Loading…</p>;
  if (starred.length === 0) {
    return (
      <div className="card text-center">
        <p className="font-serif text-xl">Nothing starred yet</p>
        <p className="mt-1 text-muted">Open a topic and press ☆ Star to add it to your review list.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {starred.map((s) => (
        <li key={s.starId} className="card flex items-start justify-between gap-4">
          <Link href={`/topics/${s.topicId}`} className="flex-1 hover:underline-offset-2">
            <p className="text-xs uppercase tracking-wide text-muted">{s.courseTitle}</p>
            <h2 className="mt-0.5 font-medium">{s.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{s.summary}</p>
          </Link>
          <StarButton topicId={s.topicId} />
        </li>
      ))}
    </ul>
  );
}

export default function StarredPage() {
  return (
    <AppShell>
      <h1 className="font-serif text-3xl">Starred</h1>
      <p className="mb-6 mt-1 text-muted">Your review list of concepts to revisit.</p>
      <StarredList />
    </AppShell>
  );
}
