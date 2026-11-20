"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { ChatPanel, useChat } from "@/components/reader/Chat";
import { CiteUnit } from "@/components/reader/CitedText";
import { NoteWindow, ReflectionsPanel, useReflections } from "@/components/reader/Reflections";
import { RightPanel, StudyTab, StudyTabSpec } from "@/components/reader/RightPanel";
import { Icons } from "@/components/reader/Tooltip";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";

type ArticleDoc = Omit<Doc<"documents">, "fileId">;

// Links inside an article open in a new tab; images load lazily and don't tell the site who's reading.
const mdComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-dark underline underline-offset-2">
      {children}
    </a>
  ),
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) =>
    typeof src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" className="my-4 max-h-[420px] rounded-lg" />
    ) : null,
};

// An article in reader mode: its text (fetched once, when it was added) with Ask and a note beside it.
export function ArticleReader({ doc }: { doc: ArticleDoc }) {
  const blocks = useQuery(api.links.blocks, { documentId: doc._id });
  const touch = useMutation(api.documents.saveProgress);
  const ranges = useMemo(() => chapterRanges(doc.sections ?? [], doc.pageCount ?? 1), [doc.sections, doc.pageCount]);
  const readable = doc.hasText !== false;

  const jumpTo = useCallback((part: number) => {
    const el = document.getElementById(`part-${part}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("hl-flash");
    void el.offsetWidth;
    el.classList.add("hl-flash");
  }, []);

  const reflections = useReflections(doc._id, ranges, jumpTo, readable);
  const chat = useChat(doc._id);
  const [studyOpen, setStudyOpen] = useState(true);
  const [tab, setTab] = useState<StudyTab>(readable ? "ask" : "notes");
  const [draft, setDraft] = useState("");

  // Opening an article counts as reading it (orders the library by recent).
  useEffect(() => {
    void touch({ documentId: doc._id, page: 1 }).catch(() => {});
  }, [touch, doc._id]);

  const tabs: StudyTabSpec[] = [
    ...(readable ? [{ key: "ask" as const, label: "Ask", icon: Icons.ask, content: <ChatPanel chat={chat} page={1} draft={draft} onDraft={setDraft} onJump={jumpTo} /> }] : []),
    { key: "notes" as const, label: "Notes", icon: <span aria-hidden="true">✏️</span>, content: <ReflectionsPanel state={reflections} ranges={ranges} currentKey="article" /> },
  ];

  return (
    <CiteUnit.Provider value="part">
      <div className="flex h-screen flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-line bg-card/95 px-4 py-2.5">
          <Link href="/read" className="retro">
            ← Library
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-serif font-semibold" title={doc.title}>
              {doc.title}
            </p>
            <p className="truncate text-xs text-muted">{doc.siteName}</p>
          </div>
          {doc.sourceUrl && (
            <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="retro" title="Open the original page in a new tab">
              Open original ↗
            </a>
          )}
          <button className="retro" aria-expanded={studyOpen} onClick={() => setStudyOpen((o) => !o)}>
            📚 Study tools
          </button>
        </header>
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8">
            <article className="mx-auto max-w-[700px] rounded-md border border-line bg-card px-6 py-10 shadow-[0_12px_30px_-24px_rgba(42,34,27,.6)] md:px-14">
              <p className="mb-2 flex items-center gap-2 text-[13px] text-muted">
                <span className="rounded border border-line bg-panel px-1.5 text-[11px] font-bold uppercase tracking-wide">Article</span>
                {doc.siteName} · reader mode
              </p>
              <h1 className="font-serif text-3xl font-bold leading-tight">{doc.title}</h1>
              {!readable ? (
                <div className="mt-6 rounded-xl border-2 border-dashed border-line bg-cream p-5">
                  <p className="font-semibold">We couldn&apos;t read this page here.</p>
                  <p className="mt-1 text-sm text-muted">It may need a login or a subscription. It&apos;s saved as a link: open the original to read it, and keep your notes here.</p>
                  {doc.sourceUrl && (
                    <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="chunky mt-4">
                      Open original ↗
                    </a>
                  )}
                </div>
              ) : blocks === undefined ? (
                <p className="mt-6 text-muted">Loading…</p>
              ) : (
                <div className="article-body mt-4 font-serif text-[18px] leading-[1.75]">
                  {blocks.map((b) => (
                    <section key={b.page} id={`part-${b.page}`} className="scroll-mt-6 rounded">
                      <Markdown components={mdComponents}>{b.text}</Markdown>
                    </section>
                  ))}
                </div>
              )}
            </article>
          </main>
          {studyOpen && <RightPanel underMenu={false} tab={tab} onTab={setTab} tabs={tabs} onClose={() => setStudyOpen(false)} />}
        </div>
        {reflections.activeKey && reflections.expanded && <NoteWindow state={reflections} />}
      </div>
    </CiteUnit.Provider>
  );
}
