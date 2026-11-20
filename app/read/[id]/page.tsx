"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bulb } from "@/components/icons/Bulb";
import { BookCover } from "@/components/library/BookCover";
import { ExportSheet } from "@/components/notebook/ExportSheet";
import { ChapterPath, Stop } from "@/components/path/ChapterPath";
import { ReadingShell } from "@/components/ReadingShell";
import { LevelBar, XpStats } from "@/components/XpStats";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";
import { bookProgress, chapterProgress, resumePage } from "@/convex/readingRules";
import { chapterBadge } from "@/components/reader/text";

// The chapter path: the main view of one book.
function PathView({ documentId }: { documentId: Id<"documents"> }) {
  const doc = useQuery(api.documents.get, { documentId });
  const notebook = useQuery(api.notebook.list, { documentId });
  const notes = notebook?.notes;
  const scores = useQuery(api.quizzes.bestScores, { documentId });
  const [exporting, setExporting] = useState(false);
  const router = useRouter();
  const notABook = !!doc && doc.sourceType !== "pdf";
  useEffect(() => {
    if (notABook) router.replace(`/read/${documentId}/book`);
  }, [notABook, router, documentId]);

  const view = useMemo(() => {
    if (!doc || doc.status !== "ready") return null;
    const pageCount = doc.pageCount ?? 0;
    const ranges = chapterRanges(doc.sections ?? [], pageCount);
    const progress = chapterProgress(ranges, doc.pagesSeen);
    const lastPage = doc.lastLocator?.page ?? null;
    const isParts = !doc.sections?.length;
    let currentIndex = lastPage === null ? -1 : ranges.findIndex((r) => lastPage >= r.startPage && lastPage <= r.endPage);
    // You're here: the chapter of the last page read, or the next unread one once that chapter is done.
    if (currentIndex >= 0 && progress[currentIndex].read) {
      const next = progress.findIndex((p, i) => i > currentIndex && !p.read);
      currentIndex = next;
    }
    if (currentIndex < 0) currentIndex = progress.findIndex((p) => !p.read);
    const withNotes = new Set((notes ?? []).map((n) => n.sectionKey));
    const stops: Stop[] = ranges.map((r, i) => ({
      ...r,
      pct: progress[i].pct,
      read: progress[i].read,
      hasNote: withNotes.has(r.key),
      current: i === currentIndex && !progress[i].read,
      label: chapterBadge(r.title, i, isParts),
      openAt: resumePage(r, lastPage, doc.pagesSeen),
      best: scores?.[r.key] ? `${scores[r.key].best}/${scores[r.key].total}` : undefined,
    }));
    return { stops, isParts, read: progress.filter((p) => p.read).length, total: ranges.length, pct: bookProgress(doc.pagesSeen, pageCount), started: lastPage !== null };
  }, [doc, notes, scores]);

  if (doc === undefined) return <p className="m-auto text-muted">Loading…</p>;
  if (doc === null) {
    return (
      <div className="m-auto text-center">
        <p>We couldn&apos;t find that book.</p>
        <Link href="/read" className="quiet mt-4">
          Back to your books
        </Link>
      </div>
    );
  }
  if (notABook) return <p className="m-auto text-muted">Opening…</p>;
  if (doc.status !== "ready" || !view) {
    return <p className="m-auto text-muted">{doc.status === "failed" ? (doc.statusMessage ?? "This book couldn't be opened.") : "Preparing your book…"}</p>;
  }

  const unit = view.isParts ? "parts" : "chapters";
  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-line bg-card/95 px-4 py-3 backdrop-blur md:px-7">
        <Link href="/read" className="retro">
          ← Library
        </Link>
        <h1 className="min-w-0 truncate font-serif text-h3 font-bold" title={doc.title}>
          {doc.title}
        </h1>
        <div className="ml-auto shrink-0">
          <XpStats level={false} />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1060px] items-start gap-10 px-4 pb-20 pt-7 md:grid-cols-[300px_1fr] md:px-7">
        <aside className="rounded-2xl border border-line bg-card p-5 md:sticky md:top-[84px]">
          <BookCover id={doc._id} title={doc.title} meta={doc.pageCount ? `${doc.pageCount} pages` : undefined} coverUrl={doc.coverUrl} className="mx-auto w-[170px] text-h3" />
          <div className="mb-1.5 mt-3.5 flex justify-between text-meta text-muted">
            <span>Your path</span>
            <span>
              {view.read} of {view.total} {unit} read
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-good" style={{ width: `${view.pct}%` }} />
          </div>
          <LevelBar />
          <Link href={`/read/${doc._id}/book`} className="chunky mt-4 w-full">
            📖 {view.started ? "Continue reading" : "Start reading"}
          </Link>
          <div className="mt-2.5 flex gap-2">
            <Link href={`/read/${doc._id}/book?notebook=1`} className="quiet flex-1">
              📓 Notebook
            </Link>
            <button className="quiet flex-1" onClick={() => setExporting(true)}>
              ⤓ Export notes
            </button>
          </div>
          {exporting && <ExportSheet documentId={doc._id} onClose={() => setExporting(false)} />}
          <p className="mt-4 text-label leading-relaxed text-muted">
            📖 Read · ✏️ Notes · <Bulb size={14} /> Test
            <br />
            Green means done. Click any of them to open it.
            {view.isParts && (
              <>
                <br />
                This PDF has no contents, so it&apos;s split into parts of 20 pages.
              </>
            )}
          </p>
        </aside>
        <ChapterPath documentId={doc._id} stops={view.stops} />
      </div>
    </div>
  );
}

export default function PathPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <ReadingShell chrome={false}>
      <PathView documentId={id as Id<"documents">} />
    </ReadingShell>
  );
}
