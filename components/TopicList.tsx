"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

export function TopicList({ courseId }: { courseId: string }) {
  const topics = useQuery(api.topics.listByCourse, { courseId });
  if (!topics) return null;
  return (
    <section>
      <h2 className="mb-3 font-serif text-2xl">Key topics</h2>
      <ol className="grid gap-3 sm:grid-cols-2">
        {topics.map((t, i) => (
          <li key={t._id}>
            <Link href={`/topics/${t._id}`} className="card flex h-full gap-4 transition hover:border-accent">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-serif font-semibold">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{t.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{t.summary}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
