"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { errorMessage } from "@/components/FieldError";
import { NotebookPanel } from "@/components/notebook/NotebookPanel";
import { useNotebook } from "@/components/notebook/useNotebook";
import { ChatPanel, useChat } from "@/components/reader/Chat";
import { CiteUnit } from "@/components/reader/CitedText";
import { RightPanel, StudyTab, StudyTabSpec } from "@/components/reader/RightPanel";
import { SelectionMenu } from "@/components/reader/SelectionMenu";
import { Icons } from "@/components/reader/Tooltip";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";
import type { TextRange } from "@/convex/highlightRules";
import { flashHighlight, paintHighlights, selectionRange } from "./textHighlights";

type ArticleDoc = Omit<Doc<"documents">, "fileId">;
const NO_HIGHLIGHTS: Doc<"highlights">[] = [];

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

// One block of text. Memoised: blocks never change, so React leaves their DOM alone (highlights are painted over it).
const Block = memo(function Block({ n, text }: { n: number; text: string }) {
  return (
    <section id={`part-${n}`} data-block={n} className="scroll-mt-6 rounded">
      <Markdown components={mdComponents}>{text}</Markdown>
    </section>
  );
});

// An article in reader mode: its text (fetched once, when it was added) with Ask and the Notebook beside it.
// Select text to highlight it, comment on it or ask about it.
export function ArticleReader({ doc }: { doc: ArticleDoc }) {
  const blocks = useQuery(api.links.blocks, { documentId: doc._id });
  const touch = useMutation(api.documents.saveProgress);
  const addHighlight = useMutation(api.notebook.addTextHighlight);
  const setComment = useMutation(api.highlights.setComment);
  const removeHighlight = useMutation(api.highlights.remove);
  const ranges = useMemo(() => chapterRanges(doc.sections ?? [], doc.pageCount ?? 1), [doc.sections, doc.pageCount]);
  const sections = useMemo(() => doc.sections ?? [], [doc.sections]);
  const readable = doc.hasText !== false;
  const highlights = useQuery(api.highlights.list, readable ? { documentId: doc._id } : "skip") ?? NO_HIGHLIGHTS;
  const textRef = useRef<HTMLDivElement>(null);

  const jumpTo = useCallback((part: number) => {
    const el = document.getElementById(`part-${part}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("hl-flash");
    void el.offsetWidth;
    el.classList.add("hl-flash");
  }, []);

  const notebook = useNotebook(doc._id);
  const chat = useChat(doc._id);
  const [studyOpen, setStudyOpen] = useState(true);
  const [tab, setTab] = useState<StudyTab>(readable ? "ask" : "notebook");
  const [wide, setWide] = useState(false);
  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<{ x: number; y: number; range: TextRange; text: string } | null>(null);
  const [editingId, setEditingId] = useState<Id<"highlights"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Opening an article counts as reading it (orders the library by recent).
  useEffect(() => {
    void touch({ documentId: doc._id, page: 1 }).catch(() => {});
  }, [touch, doc._id]);

  // Paint the highlights whenever they or the text change.
  useEffect(() => {
    if (textRef.current && blocks) paintHighlights(textRef.current, highlights.flatMap((h) => (h.range ? [h.range] : [])));
  }, [highlights, blocks]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Show the selection menu once the reader finishes selecting.
  const onSelectEnd = useCallback(() => {
    if (!readable || !textRef.current) return;
    const s = selectionRange(textRef.current);
    setSelection(s ? { x: s.rect.left + s.rect.width / 2, y: s.rect.top, range: s.range, text: s.text } : null);
  }, [readable]);

  async function createHighlight(withComment: boolean) {
    if (!selection) return;
    const { range, text } = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    try {
      const id = await addHighlight({ documentId: doc._id, text, range });
      if (withComment) {
        setTab("notebook");
        setStudyOpen(true);
        setEditingId(id);
      } else setNotice("Highlighted · it's in your Notebook");
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  const tabs: StudyTabSpec[] = [
    ...(readable ? [{ key: "ask" as const, label: "Ask", icon: Icons.ask, content: <ChatPanel noun="article" chat={chat} page={1} draft={draft} onDraft={setDraft} onJump={jumpTo} /> }] : []),
    {
      key: "notebook" as const,
      label: "Notebook",
      icon: <span aria-hidden="true">📓</span>,
      count: notebook.notes.length + highlights.length,
      content: (
        <NotebookPanel
          state={notebook}
          highlights={highlights}
          ranges={ranges}
          sections={sections}
          currentKey={ranges[0]?.key ?? null}
          single
          canValidate={readable}
          wide={wide}
          citeUnit="§"
          editingId={editingId}
          onEditComment={setEditingId}
          onSetComment={(id, comment) => {
            setEditingId(null);
            setComment({ highlightId: id, comment }).catch((err) => setNotice(errorMessage(err)));
          }}
          onRemoveHighlight={(id) => void removeHighlight({ highlightId: id }).catch((err) => setNotice(errorMessage(err)))}
          onJumpHighlight={(h) => h.range && textRef.current && flashHighlight(textRef.current, h.range)}
          onJumpPage={jumpTo}
          onNotice={setNotice}
          emptyHint={readable ? "Nothing here yet. Select text to highlight it, or write a note." : "Nothing here yet. Write a note about what you read."}
        />
      ),
    },
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
            <p className="truncate text-label text-muted">{doc.siteName}</p>
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
        <div className="relative flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8" onScroll={() => selection && setSelection(null)}>
            <article className="mx-auto max-w-[700px] rounded-md border border-line bg-card px-6 py-10 shadow-[0_12px_30px_-24px_rgba(42,34,27,.6)] md:px-14">
              <p className="mb-2 flex items-center gap-2 text-meta text-muted">
                <span className="kind">Article</span>
                {doc.siteName} · reader mode
              </p>
              <h1 className="font-serif text-h1 font-bold leading-tight">{doc.title}</h1>
              {!readable ? (
                <div className="mt-6 rounded-xl border-2 border-dashed border-line bg-cream p-5">
                  <p className="font-semibold">We couldn&apos;t read this page here.</p>
                  <p className="mt-1 text-meta text-muted">It may need a login or a subscription. It&apos;s saved as a link: open the original to read it, and keep your notes here.</p>
                  {doc.sourceUrl && (
                    <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="chunky mt-4">
                      Open original ↗
                    </a>
                  )}
                </div>
              ) : blocks === undefined ? (
                <p className="mt-6 text-muted">Loading…</p>
              ) : (
                <div ref={textRef} className="article-body mt-4 font-serif text-read leading-[1.75]" onMouseUp={onSelectEnd} onKeyUp={onSelectEnd}>
                  {blocks.map((b) => (
                    <Block key={b.page} n={b.page} text={b.text} />
                  ))}
                </div>
              )}
            </article>
          </main>
          {studyOpen && (
            <RightPanel underMenu={false} tab={tab} onTab={setTab} tabs={tabs} onClose={() => setStudyOpen(false)} wide={wide && tab === "notebook"} onWide={tab === "notebook" ? setWide : undefined} />
          )}
        </div>
        {selection && (
          <SelectionMenu
            selection={selection}
            onHighlight={() => void createHighlight(false)}
            onComment={() => void createHighlight(true)}
            onAsk={() => {
              setDraft(`Explain this: "${selection.text.slice(0, 600)}"`);
              setTab("ask");
              setStudyOpen(true);
              setSelection(null);
              window.getSelection()?.removeAllRanges();
            }}
          />
        )}
        {notice && (
          <p role="alert" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-ui text-paper shadow-lg">
            {notice}
          </p>
        )}
      </div>
    </CiteUnit.Provider>
  );
}
