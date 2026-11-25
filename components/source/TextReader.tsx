"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { errorMessage } from "@/components/FieldError";
import { NotebookPanel } from "@/components/notebook/NotebookPanel";
import { useNotebook } from "@/components/notebook/useNotebook";
import { ChatPanel, useChat } from "@/components/reader/Chat";
import { CiteUnit } from "@/components/reader/CitedText";
import { ContentsPanel } from "@/components/reader/ContentsPanel";
import { BookMindMap } from "@/components/reader/BookMindMap";
import { MoreTools } from "@/components/reader/MoreTools";
import { ChapterEndNotice } from "@/components/reader/Reader";
import { RightPanel, StudyTab, StudyTabSpec } from "@/components/reader/RightPanel";
import { SelectionMenu } from "@/components/reader/SelectionMenu";
import { chapterBadge, readableTitle } from "@/components/reader/text";
import { Icons } from "@/components/reader/Tooltip";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";
import { cleanArticleBlocks } from "@/convex/linkRules";
import type { TextRange } from "@/convex/highlightRules";
import { chapterProgress } from "@/convex/readingRules";
import { flashHighlight, paintHighlights, selectionRange } from "./textHighlights";

type TextDoc = Omit<Doc<"documents">, "fileId"> & { coverUrl?: string | null };
const NO_HIGHLIGHTS: Doc<"highlights">[] = [];
const KIND_LABEL = { article: "Article", epub: "EPUB", word: "Word", powerpoint: "PowerPoint" } as const;

// Links inside the text open in a new tab; images load lazily and don't tell the site who's reading.
const mdComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-dark underline underline-offset-2">
      {children}
    </a>
  ),
  img: ({ src, alt }: { src?: string | Blob; alt?: string }) =>
    typeof src === "string" && /^https:\/\//.test(src) ? (
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

// The text reader for articles, EPUB books, Word and PowerPoint files: the text (stored once as blocks) with
// Ask and the Notebook beside it. Select text to highlight it, comment on it or ask about it. EPUBs are books:
// Contents, a chapter path, % read by scrolling, and the end-of-chapter card. Word and PowerPoint get Contents
// but no path, tests or XP.
export function TextReader({ doc, startPage, startNotes, startNotebook }: { doc: TextDoc; startPage?: number; startNotes?: string; startNotebook?: boolean }) {
  const kind = doc.sourceType as keyof typeof KIND_LABEL;
  const isArticle = kind === "article";
  const isBook = kind === "epub";
  const rawBlocks = useQuery(api.links.blocks, { documentId: doc._id });
  // Articles are shown without the site's buttons and counters, and we say so when only the free part came through.
  const cleaned = useMemo(() => (rawBlocks && doc.sourceType === "article" ? cleanArticleBlocks(rawBlocks, doc.title) : { blocks: rawBlocks, partial: false }), [rawBlocks, doc.sourceType, doc.title]);
  const blocks = cleaned.blocks;
  const checkEmbed = useAction(api.links.canEmbed);
  const [articleView, setArticleView] = useState<"reader" | "original">("reader");
  const [embeddable, setEmbeddable] = useState<boolean | null>(null); // null = not checked yet
  const saveProgress = useMutation(api.documents.saveProgress);
  const addHighlight = useMutation(api.notebook.addTextHighlight);
  const setComment = useMutation(api.highlights.setComment);
  const removeHighlight = useMutation(api.highlights.remove);
  const pageCount = doc.pageCount ?? 1;
  const sections = useMemo(() => doc.sections ?? [], [doc.sections]);
  const ranges = useMemo(() => chapterRanges(sections, pageCount), [sections, pageCount]);
  const progress = useMemo(() => chapterProgress(ranges, doc.pagesSeen), [ranges, doc.pagesSeen]);
  const readKeys = useMemo(() => new Set(progress.filter((p) => p.read).map((p) => p.key)), [progress]);
  const readable = doc.hasText !== false;
  const hasContents = !isArticle && (sections.length > 1 || ranges.length > 1); // Contents lists every heading
  const oneChapter = ranges.length <= 1; // the Notebook needs no chapter picker
  const highlights = useQuery(api.highlights.list, readable ? { documentId: doc._id } : "skip") ?? NO_HIGHLIGHTS;
  const textRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);

  const jumpTo = useCallback((part: number) => {
    const el = document.getElementById(`part-${part}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("hl-flash");
    void el.offsetWidth;
    el.classList.add("hl-flash");
  }, []);

  const notebook = useNotebook(doc._id);
  const { write: writeNote } = notebook;
  const chat = useChat(doc._id);
  const initialPage = startPage && startPage >= 1 && startPage <= pageCount ? startPage : (doc.lastLocator?.page ?? 1);
  const [page, setPage] = useState(initialPage);
  const [studyOpen, setStudyOpen] = useState(isArticle || !!startNotes || !!startNotebook);
  const [tab, setTab] = useState<StudyTab>(readable && !startNotes && !startNotebook ? "ask" : "notebook");
  const [mapOpen, setMapOpen] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<{ x: number; y: number; range: TextRange; text: string } | null>(null);
  const [editingId, setEditingId] = useState<Id<"highlights"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [endNotice, setEndNotice] = useState<number | null>(null);
  const chapterIndex = ranges.findIndex((r) => page >= r.startPage && page <= r.endPage);
  const chapter = chapterIndex >= 0 ? ranges[chapterIndex] : null;

  // Open where the reader left off (or where the path / a test link points), once the text is there.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !blocks?.length) return;
    opened.current = true;
    if (initialPage > 1) requestAnimationFrame(() => document.getElementById(`part-${initialPage}`)?.scrollIntoView({ block: "start" }));
  }, [blocks, initialPage]);

  // From a chapter's Notes marker on the path: a new note on that chapter if it has none yet.
  const openedNotes = useRef(false);
  useEffect(() => {
    if (openedNotes.current || !startNotes || !notebook.loaded || !ranges.some((r) => r.key === startNotes)) return;
    openedNotes.current = true;
    if (!notebook.notes.some((n) => n.sectionKey === startNotes)) writeNote(startNotes);
  }, [startNotes, ranges, writeNote, notebook.loaded, notebook.notes]);

  // Reading progress: the block at the top is "where you are"; a block counts as read after ~2 s on screen
  // (the same rule as PDF pages). Saved every few seconds and when leaving.
  const visibleSince = useRef(new Map<number, number>());
  const seenAlready = useRef(new Set<number>());
  const seenPending = useRef(new Set<number>());
  const pageRef = useRef(initialPage);
  const savedPage = useRef(-1);
  const endOf = useMemo(() => new Map(ranges.map((r, i) => [r.endPage, i])), [ranges]);
  const noticed = useRef(new Set<number>());
  useEffect(() => {
    const known = new Set<number>();
    (doc.pagesSeen ?? "").split("").forEach((c, i) => c === "1" && known.add(i + 1));
    seenAlready.current = known;
  }, [doc.pagesSeen]);
  useEffect(() => {
    const root = scroller.current;
    if (!root || !blocks?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.block);
          if (e.isIntersecting) visibleSince.current.set(n, visibleSince.current.get(n) ?? now);
          else visibleSince.current.delete(n);
        }
        const top = [...visibleSince.current.keys()].sort((a, b) => a - b)[0];
        if (top) {
          pageRef.current = top;
          setPage(top);
        }
      },
      { root, threshold: 0.15 }
    );
    root.querySelectorAll("[data-block]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [blocks]);
  const flush = useCallback(() => {
    if (seenPending.current.size === 0 && pageRef.current === savedPage.current) return;
    const seen = [...seenPending.current];
    seenPending.current.clear();
    savedPage.current = pageRef.current;
    void saveProgress({ documentId: doc._id, page: pageRef.current, seen }).catch(() => seen.forEach((p) => seenPending.current.add(p)));
  }, [doc._id, saveProgress]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const [n, t] of visibleSince.current) {
        if (now - t < 2000) continue;
        if (!seenAlready.current.has(n)) {
          seenAlready.current.add(n);
          seenPending.current.add(n);
        }
        const end = endOf.get(n);
        if (isBook && end !== undefined && !noticed.current.has(end)) {
          noticed.current.add(end);
          setEndNotice(end);
        }
      }
    }, 500);
    const saver = window.setInterval(flush, 3000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(saver);
      flush();
    };
  }, [flush, endOf, isBook]);

  // Paint the highlights whenever they or the text change.
  useEffect(() => {
    if (textRef.current && blocks) paintHighlights(textRef.current, highlights.flatMap((h) => (h.range ? [h.range] : [])));
  }, [highlights, blocks]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Esc closes the contents and the study tools, unless the reader is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) return;
      setContentsOpen(false);
      if (!isArticle) setStudyOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isArticle]);

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

  function showOriginal() {
    setArticleView("original");
    if (embeddable === null) void checkEmbed({ documentId: doc._id }).then(setEmbeddable, () => setEmbeddable(false));
  }

  const noun = isArticle ? "article" : isBook ? "book" : "document";
  const tabs: StudyTabSpec[] = [
    ...(readable ? [{ key: "ask" as const, label: "Ask", icon: Icons.ask, content: <ChatPanel noun={noun} chat={chat} page={page} draft={draft} onDraft={setDraft} onJump={jumpTo} /> }] : []),
    {
      key: "notebook" as const,
      label: "Notebook",
      icon: <span aria-hidden="true">📓</span>,
      count: notebook.notes.length + highlights.length + notebook.saved.length,
      content: (
        <NotebookPanel
          state={notebook}
          highlights={highlights}
          ranges={ranges}
          sections={sections}
          currentKey={chapter?.key ?? ranges[0]?.key ?? null}
          single={oneChapter}
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
          kinds={isBook ? ["notes", "highlights", "saved"] : readable ? ["notes", "highlights"] : ["notes"]}
          emptyHint={readable ? "Nothing here yet. Select text to highlight it, or write a note." : "Nothing here yet. Write a note about what you read."}
        />
      ),
    },
    ...(isBook ? [{ key: "more" as const, label: "More", icon: <span aria-hidden="true">🧰</span>, content: (
            <MoreTools practiceHref={chapter ? `/read/${doc._id}/test?chapter=${encodeURIComponent(chapter.key)}` : undefined} onMindMap={() => setMapOpen(true)} />
          ),
        },
      ]
    : []),
  ];
  const chapterPct = chapterIndex >= 0 ? progress[chapterIndex].pct : 0;

  return (
    <CiteUnit.Provider value="part">
      <div className="flex h-screen flex-col">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-line bg-cream px-4 py-2.5">
          <Link href={isBook ? `/read/${doc._id}` : "/read"} className="retro">
            ← {isBook ? "Path" : "Library"}
          </Link>
          {hasContents && (
            <button className="retro" aria-expanded={contentsOpen} aria-controls="contents" onClick={() => setContentsOpen((o) => !o)}>
              ☰ Contents
            </button>
          )}
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-serif font-semibold" title={doc.title}>
              {isBook && chapter ? readableTitle(chapter.title) : doc.title}
            </p>
            {isBook && chapter ? (
              <div className="mx-auto mt-1.5 h-1 max-w-[220px] overflow-hidden rounded-full bg-line" aria-label={`${chapterPct}% of this chapter read`}>
                <div className="h-full rounded-full bg-good" style={{ width: `${chapterPct}%` }} />
              </div>
            ) : (
              <p className="truncate text-label text-muted">{isArticle ? doc.siteName : KIND_LABEL[kind]}</p>
            )}
          </div>
          {isArticle && doc.sourceUrl && readable && (
            <div role="group" aria-label="How to view this article" className="seg shrink-0">
              <button aria-pressed={articleView === "reader"} onClick={() => setArticleView("reader")} className="px-3 py-1">
                Reader
              </button>
              <button aria-pressed={articleView === "original"} onClick={showOriginal} className="px-3 py-1">
                Original
              </button>
            </div>
          )}
          {isArticle && doc.sourceUrl && (
            <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="retro" title="Open the original page in a new tab">
              Open ↗
            </a>
          )}
          <button className="retro" aria-expanded={studyOpen} aria-controls="right-panel" onClick={() => setStudyOpen((o) => !o)}>
            📚 Study tools
          </button>
        </header>
        <div className="relative flex min-h-0 flex-1">
          {contentsOpen && (
            <aside id="contents" className="h-full w-[340px] shrink-0 border-r-[1.5px] border-ink bg-cream">
              <ContentsPanel
                sections={sections}
                ranges={ranges}
                readKeys={isBook ? readKeys : new Set()}
                page={page}
                showPages={false}
                onJump={(p) => {
                  jumpTo(p);
                  setContentsOpen(false);
                }}
                onClose={() => setContentsOpen(false)}
              />
            </aside>
          )}
          {articleView === "original" && doc.sourceUrl && (
            <div className="min-w-0 flex-1 bg-canvas">
              {embeddable ? (
                // Sandboxed: the page can run, but can't reach the app or navigate it.
                <iframe src={doc.sourceUrl} title={`Original: ${doc.title}`} sandbox="allow-scripts allow-same-origin allow-popups allow-forms" referrerPolicy="no-referrer" className="h-full w-full border-0" />
              ) : (
                <div className="grid h-full place-items-center px-6 text-center">
                  {embeddable === null ? (
                    <p className="text-muted">Checking if this site can be shown here…</p>
                  ) : (
                    <div className="max-w-md">
                      <p className="font-serif text-h2 font-bold">{doc.siteName ?? "This site"} doesn&apos;t allow being shown inside other apps</p>
                      <p className="mt-2 text-muted">Open it in a new tab. Your notes and Ask stay here.</p>
                      <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="chunky mt-4">
                        Open original ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <main hidden={articleView === "original"} ref={scroller} className="relative min-w-0 flex-1 overflow-y-auto bg-canvas px-4 py-8" onScroll={() => selection && setSelection(null)}>
            <article className="mx-auto max-w-[700px] px-6 py-6 md:px-10">
              <p className="mb-2 flex items-center gap-2 text-meta text-muted">
                <span className="kind">{KIND_LABEL[kind]}</span>
                {isArticle ? `${doc.siteName ?? ""} · reader mode` : kind === "powerpoint" ? "Slide text only" : null}
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
                <>
                {cleaned.partial && (
                  <div role="note" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
                    <p className="min-w-0 flex-1 text-meta">
                      <b>This is the free preview.</b> The rest is for the site&apos;s subscribers.
                    </p>
                    <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className="quiet shrink-0">
                      Read the full post ↗
                    </a>
                  </div>
                )}
                <div ref={textRef} className="article-body mt-4 font-serif text-read leading-[1.75]" onMouseUp={onSelectEnd} onKeyUp={onSelectEnd}>
                  {blocks.map((b) => (
                    <Block key={b.page} n={b.page} text={b.text} />
                  ))}
                </div>
                </>
              )}
            </article>
          </main>
          {endNotice !== null && ranges[endNotice] && (
            <ChapterEndNotice
              range={ranges[endNotice]}
              number={chapterBadge(ranges[endNotice].title, endNotice, false)}
              isPart={false}
              onClose={() => setEndNotice(null)}
              onNote={() => {
                writeNote(ranges[endNotice].key);
                setTab("notebook");
                setStudyOpen(true);
                setEndNotice(null);
              }}
              testHref={`/read/${doc._id}/test?chapter=${encodeURIComponent(ranges[endNotice].key)}`}
              read={readKeys.has(ranges[endNotice].key)}
            />
          )}
          {studyOpen && (
            <RightPanel underMenu={false} tab={tab} onTab={setTab} tabs={tabs} onClose={() => setStudyOpen(false)} wide={wide && tab === "notebook"} onWide={tab === "notebook" ? setWide : undefined} />
          )}
        </div>
        {selection && (
          <SelectionMenu
            selection={selection}
            onHighlight={() => void createHighlight(false)}
            onComment={() => void createHighlight(true)}
            onAsk={
              readable
                ? () => {
                    setDraft(`Explain this: "${selection.text.slice(0, 600)}"`);
                    setTab("ask");
                    setStudyOpen(true);
                    setSelection(null);
                    window.getSelection()?.removeAllRanges();
                  }
                : undefined
            }
          />
        )}
        {mapOpen && (
          <BookMindMap documentId={doc._id} title={doc.title} ranges={ranges} sections={sections} currentKey={chapter?.key ?? null} onJump={jumpTo} onClose={() => setMapOpen(false)} />
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
