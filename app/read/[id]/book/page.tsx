"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ReadingShell } from "@/components/ReadingShell";
import { Reader } from "@/components/reader/Reader";
import { ArticleReader } from "@/components/source/ArticleReader";
import { VideoView } from "@/components/source/VideoView";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

function ReaderRoute() {
  const { id } = useParams<{ id: string }>();
  // From the chapter path: ?page=N opens at a chapter, &notes=KEY opens its note.
  const params = useSearchParams();
  const startPage = Number(params.get("page")) || undefined;
  const startNotes = params.get("notes") ?? undefined;
  const documentId = id as Id<"documents">;
  const doc = useQuery(api.documents.get, { documentId });
  const url = useQuery(api.documents.fileUrl, { documentId });

  let body;
  if (doc && doc.status === "ready" && doc.sourceType !== "pdf") {
    return (
      <ReadingShell chrome={false}>
        {doc.sourceType === "video" ? <VideoView key={doc._id} doc={doc} /> : <ArticleReader key={doc._id} doc={doc} />}
      </ReadingShell>
    );
  }
  if (doc === undefined || (doc?.status === "ready" && url === undefined)) {
    body = <p className="m-auto text-muted">Loading…</p>;
  } else if (doc === null) {
    body = (
      <div className="m-auto text-center">
        <p>We couldn&apos;t find that book.</p>
        <Link href="/read" className="btn-ghost mt-4">
          Back
        </Link>
      </div>
    );
  } else if (doc.status === "processing") {
    body = <p className="m-auto text-muted">Preparing your book…</p>;
  } else if (doc.status === "failed" || !url) {
    body = (
      <div className="m-auto text-center">
        <p className="text-bad">{doc.statusMessage ?? "This book couldn't be opened."}</p>
        <Link href="/read" className="btn-ghost mt-4">
          Back
        </Link>
      </div>
    );
  } else {
    // key: a fresh reader per book, so position and zoom never leak between books
    return (
      <ReadingShell chrome={false}>
        <Reader key={doc._id} doc={doc} url={url} startPage={startPage} startNotes={startNotes} />
      </ReadingShell>
    );
  }
  return <ReadingShell>{body}</ReadingShell>;
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<p className="m-auto text-muted">Loading…</p>}>
      <ReaderRoute />
    </Suspense>
  );
}
