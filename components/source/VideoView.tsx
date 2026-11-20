"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NoteWindow, ReflectionsPanel, useReflections } from "@/components/reader/Reflections";
import { RightPanel, StudyTab, StudyTabSpec } from "@/components/reader/RightPanel";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";

type VideoDoc = Omit<Doc<"documents">, "fileId">;

// A YouTube video, played by YouTube's own embedded player (privacy-enhanced domain), with a note beside it.
// No Ask, tests or XP for videos yet (Feature 3 spec).
export function VideoView({ doc }: { doc: VideoDoc }) {
  const touch = useMutation(api.documents.saveProgress);
  const ranges = useMemo(() => chapterRanges(doc.sections ?? [], doc.pageCount ?? 1), [doc.sections, doc.pageCount]);
  const reflections = useReflections(doc._id, ranges, () => {}, false);
  const [studyOpen, setStudyOpen] = useState(true);
  const [tab, setTab] = useState<StudyTab>("notes");

  useEffect(() => {
    void touch({ documentId: doc._id, page: 1 }).catch(() => {});
  }, [touch, doc._id]);

  const tabs: StudyTabSpec[] = [{ key: "notes", label: "Notes", icon: <span aria-hidden="true">✏️</span>, content: <ReflectionsPanel state={reflections} ranges={ranges} currentKey="video" /> }];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card/95 px-4 py-2.5">
        <Link href="/read" className="retro">
          ← Library
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-serif font-semibold" title={doc.title}>
            {doc.title}
          </p>
          <p className="truncate text-label text-muted">YouTube · {doc.siteName}</p>
        </div>
        <button className="retro" aria-expanded={studyOpen} onClick={() => setStudyOpen((o) => !o)}>
          ✏️ Notes
        </button>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-[900px]">
            <div className="aspect-video overflow-hidden rounded-2xl bg-black shadow-[0_16px_34px_-22px_rgba(0,0,0,.7)]">
              {doc.videoId && (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${doc.videoId}?rel=0`}
                  title={doc.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
            </div>
            <h1 className="mt-4 font-serif text-h2 font-bold leading-snug">{doc.title}</h1>
            <p className="mt-1 text-meta text-muted">
              {doc.siteName} ·{" "}
              {doc.sourceUrl && (
                <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent-dark underline">
                  Open on YouTube ↗
                </a>
              )}
            </p>
            <p className="mt-3 text-meta text-muted">Watch and write what you took away in Notes. Timed notes and Ask for videos come later.</p>
          </div>
        </main>
        {studyOpen && <RightPanel underMenu={false} tab={tab} onTab={setTab} tabs={tabs} onClose={() => setStudyOpen(false)} />}
      </div>
      {reflections.activeKey && reflections.expanded && <NoteWindow state={reflections} />}
    </div>
  );
}
