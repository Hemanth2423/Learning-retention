"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ReadingShell } from "@/components/ReadingShell";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// A placeholder until the quiz experience is designed.
export default function TestPage() {
  const { id } = useParams<{ id: string }>();
  const doc = useQuery(api.documents.get, { documentId: id as Id<"documents"> });

  return (
    <ReadingShell>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <h1 className="font-serif text-3xl">Test your understanding</h1>
        <p className="mt-3 text-muted">Coming soon.{doc ? ` We're still designing how you'll be tested on “${doc.title}”.` : ""}</p>
        <Link href={`/read/${id}`} className="btn-primary mt-8">
          Back to the book
        </Link>
      </main>
    </ReadingShell>
  );
}
