"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { ReadingShell } from "@/components/ReadingShell";
import { UploadCard } from "@/components/upload/UploadCard";
import { api } from "@/convex/_generated/api";

function Latest() {
  const latest = useQuery(api.documents.latest);
  if (!latest) return null;
  return (
    <p className="mt-6 text-center text-sm text-muted">
      Continue reading:{" "}
      <Link href={`/read/${latest._id}`} className="font-medium text-ink underline underline-offset-2">
        {latest.title}
      </Link>
    </p>
  );
}

export default function UploadPage() {
  return (
    <ReadingShell>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-24">
        <h1 className="text-center font-serif text-3xl">Add a book to start reading</h1>
        <div className="mt-8">
          <UploadCard />
        </div>
        <Latest />
      </main>
    </ReadingShell>
  );
}
