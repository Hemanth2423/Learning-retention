"use client";

import { XP } from "@/convex/xpRules";
import type { Locator } from "@/convex/locators";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ChapterRange, chapterRanges } from "@/convex/chapters";
import { chapterProgress } from "@/convex/readingRules";
import { Bulb } from "@/components/icons/Bulb";
import { ContentsPanel } from "./ContentsPanel";
import { HighlightsPanel } from "./HighlightsPanel";
import { PdfViewer, PdfViewerHandle, SelectionInfo } from "./PdfViewer";
import { ChatPanel, useChat } from "./Chat";
import { PageNav } from "./PageNav";
import { NoteWindow, ReflectionsPanel, useReflections } from "./Reflections";
import { MoreTools } from "./MoreTools";
import { RightPanel, StudyTab } from "./RightPanel";
import { chapterBadge, readableTitle } from "./text";
import { SelectionMenu } from "./SelectionMenu";
import { Icons } from "./Tooltip";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const NO_HIGHLIGHTS: Doc<"highlights">[] = [];
const NOTE_ICON = <span aria-hidden="true">✏️</span>;
const MORE_ICON = <span aria-hidden="true">🧰</span>;

type ReaderDoc = {
  _id: Id<"documents">;
  title: string;
  pageCount?: number;
  hasText?: boolean;
  sections?: { key: string; title: string; level: number; locator: Locator }[];
  lastLocator?: Locator;
  pagesSeen?: string;
};

// A closable notification at the bottom of the book when a chapter ends: write a note or test yourself.
function ChapterEndNotice({
  range,
  number,
  isPart,
  read,
  onNote,
  testHref,
  onClose,
}: {
  range: ChapterRange;
  number: string;
  isPart: boolean;
  read: boolean; // every page seen: the reading XP has been earned
  onNote: () => void;
  testHref: string;
  onClose: () => void;
}) {
  return (
    <section
      role="status"
      aria-label={`End of ${isPart ? "part" : "chapter"} ${number}`}
      className="absolute bottom-20 left-1/2 z-20 w-[min(560px,calc(100%-32px))] -translate-x-1/2 rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_5px_0_var(--ink)]"
    >
      <button onClick={onClose} aria-label="Close" title="Close" className="icon-btn absolute right-3 top-3">
        ✕
      </button>
      <p className="font-game text-label text-good">
        {isPart ? `END OF PART ${number.slice(1)}` : number === "•" ? "END OF THIS SECTION" : `END OF CHAPTER ${number}`}
        {read && ` · +${XP.read} XP FOR READING`}
      </p>
      <h2 className="mt-1 pr-8 font-serif text-h2 font-bold leading-snug">Lock it in before you move on</h2>
      <p className="mt-1 line-clamp-2 text-meta text-muted">
        A note earns {XP.note} XP; each right answer earns {XP.answer}. <span className="italic">{readableTitle(range.title)}</span>
      </p>
      <div className="mt-3.5 flex flex-wrap gap-3">
        <button onClick={onNote} className="chunky py-2.5">
          ✏️ Write a note
        </button>
        <Link href={testHref} className="chunky chunky-light py-2.5">
          <Bulb size={20} /> Test yourself
        </Link>
      </div>
    </section>
  );
}

// `startPage` / `startNotes` come from the chapter path: open at a chapter, or open that chapter's note.
export function Reader({ doc, url, startPage, startNotes }: { doc: ReaderDoc; url: string; startPage?: number; startNotes?: string }) {
  const pageCount = doc.pageCount ?? 1;
  const initialPage = startPage && startPage >= 1 && startPage <= pageCount ? startPage : (doc.lastLocator?.page ?? 1);
  const canHighlight = doc.hasText !== false;
  const sections = useMemo(() => doc.sections ?? [], [doc.sections]);
  const ranges = useMemo(() => chapterRanges(sections, pageCount), [sections, pageCount]);
  const isParts = sections.length === 0;
  const progress = useMemo(() => chapterProgress(ranges, doc.pagesSeen), [ranges, doc.pagesSeen]);
  const readKeys = useMemo(() => new Set(progress.filter((p) => p.read).map((p) => p.key)), [progress]);

  const saveProgress = useMutation(api.documents.saveProgress);
  const addHighlight = useMutation(api.highlights.add);
  const setComment = useMutation(api.highlights.setComment);
  const removeHighlight = useMutation(api.highlights.remove);
  const highlights = useQuery(api.highlights.list, canHighlight ? { documentId: doc._id } : "skip") ?? NO_HIGHLIGHTS;

  const viewer = useRef<PdfViewerHandle>(null);
  const jumpToPage = useCallback((p: number) => viewer.current?.jumpTo(p), []);
  const reflections = useReflections(doc._id, ranges, jumpToPage, canHighlight);
  const { open: openNote } = reflections;
  const chat = useChat(doc._id);
  const [chatDraft, setChatDraft] = useState("");
  const [page, setPage] = useState(initialPage);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyTab, setStudyTab] = useState<StudyTab>(canHighlight ? "ask" : "notes");
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [editingId, setEditingId] = useState<Id<"highlights"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const [menuShown, setMenuShown] = useState(true);
  const openStudy = useCallback((tab: StudyTab) => {
    setStudyTab(tab);
    setStudyOpen(true);
    setMenuShown(true); // the menu stays while a panel is open
  }, []);
  const zoomPercent = Math.round(ZOOMS[zoomIndex] * 100);
  const chapterIndex = ranges.findIndex((r) => page >= r.startPage && page <= r.endPage);
  const chapter = chapterIndex >= 0 ? ranges[chapterIndex] : null;
  const noteFor = useCallback(
    (key: string) => {
      openNote(key);
      openStudy("notes");
    },
    [openNote, openStudy]
  );

  // Opened from a chapter's Notes marker on the path: show that note straight away.
  const openedNotes = useRef(false);
  useEffect(() => {
    if (openedNotes.current || !startNotes || !ranges.some((r) => r.key === startNotes)) return;
    openedNotes.current = true;
    noteFor(startNotes);
  }, [startNotes, ranges, noteFor]);

  // The top menu hides while reading and comes back when the mouse moves. It stays while a panel is open.
  const overMenu = useRef(false);
  const panelsOpen = useRef(false);
  const idle = useRef<number | undefined>(undefined);
  const scheduleHide = useCallback(() => {
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      if (!overMenu.current && !panelsOpen.current) setMenuShown(false);
    }, 2500);
  }, []);
  const wake = useCallback(() => {
    setMenuShown(true);
    scheduleHide();
  }, [scheduleHide]);
  useEffect(() => {
    panelsOpen.current = contentsOpen || studyOpen;
    scheduleHide();
    return () => window.clearTimeout(idle.current);
  }, [contentsOpen, studyOpen, scheduleHide]);

  // Esc closes the contents and the study tools, unless the reader is typing somewhere (that field handles Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || reflections.expanded) return; // the larger note handles its own Esc
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) return;
      setContentsOpen(false);
      setStudyOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reflections.expanded]);

  // When a chapter's last page has been on screen for 2 seconds, a closable notice offers a note or a test.
  // Shown once per chapter per visit; closing it is enough to say "not now".
  const endOf = useMemo(() => new Map(ranges.map((r, i) => [r.endPage, i])), [ranges]);
  const endOfRef = useRef(endOf);
  useEffect(() => {
    endOfRef.current = endOf;
  }, [endOf]);
  const [endNotice, setEndNotice] = useState<number | null>(null);
  const noticed = useRef(new Set<number>());

  // Remember the page a moment after the reader stops moving, plus any pages read since the last save.
  // A page counts as read once it has been mostly on screen for 2 seconds (ARCHITECTURE.md → Feature 2).
  const saved = useRef(initialPage);
  const pageRef = useRef(initialPage);
  const visibleSince = useRef(new Map<number, number>());
  const seenAlready = useRef(new Set<number>());
  const seenPending = useRef(new Set<number>());
  useEffect(() => {
    const known = new Set<number>();
    (doc.pagesSeen ?? "").split("").forEach((c, i) => c === "1" && known.add(i + 1));
    seenAlready.current = known;
  }, [doc.pagesSeen]);
  const onVisiblePages = useCallback((pages: number[]) => {
    const now = Date.now();
    const since = visibleSince.current;
    for (const p of [...since.keys()]) if (!pages.includes(p)) since.delete(p);
    for (const p of pages) if (!since.has(p)) since.set(p, now);
  }, []);
  const flush = useCallback(() => {
    if (seenPending.current.size === 0 && pageRef.current === saved.current) return;
    const seen = [...seenPending.current];
    seenPending.current.clear();
    saved.current = pageRef.current;
    void saveProgress({ documentId: doc._id, page: pageRef.current, seen }).catch(() => seen.forEach((p) => seenPending.current.add(p)));
  }, [doc._id, saveProgress]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      for (const [p, t] of visibleSince.current) {
        if (now - t < 2000) continue;
        if (!seenAlready.current.has(p)) {
          seenAlready.current.add(p);
          seenPending.current.add(p);
        }
        const chapterEnd = endOfRef.current.get(p);
        if (chapterEnd !== undefined && !noticed.current.has(chapterEnd)) {
          noticed.current.add(chapterEnd);
          setEndNotice(chapterEnd);
        }
      }
    }, 500);
    const saver = window.setInterval(flush, 3000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(saver);
      flush(); // leaving the book saves what was read
    };
  }, [flush]);
  useEffect(() => {
    pageRef.current = page;
    if (page === saved.current) return;
    const timer = window.setTimeout(flush, 1500);
    return () => window.clearTimeout(timer);
  }, [page, flush]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function createHighlight(withComment: boolean) {
    if (!selection) return;
    const { text, segments } = selection;
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    try {
      const id = await addHighlight({ documentId: doc._id, text, segments });
      if (withComment) {
        openStudy("highlights");
        setEditingId(id);
      }
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  function saveComment(id: Id<"highlights">, comment: string) {
    setEditingId(null);
    const existing = highlights.find((h) => h._id === id);
    if (existing && (existing.comment ?? "") === comment.trim()) return;
    setComment({ highlightId: id, comment }).catch((err) => setNotice(errorMessage(err)));
  }

  if (failed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-medium text-bad">We couldn&apos;t open this PDF.</p>
        <Link href="/read" className="quiet">
          Back
        </Link>
      </div>
    );
  }

  const chapterPct = chapterIndex >= 0 ? progress[chapterIndex].pct : 0;
  const tabs = [
    ...(canHighlight ? [{ key: "ask" as const, label: "Ask", icon: Icons.ask, content: <ChatPanel chat={chat} page={page} draft={chatDraft} onDraft={setChatDraft} onJump={jumpToPage} /> }] : []),
    { key: "notes" as const, label: "Notes", icon: NOTE_ICON, content: <ReflectionsPanel key={chapter?.key ?? "none"} state={reflections} ranges={ranges} currentKey={chapter?.key ?? null} /> },
    ...(canHighlight
      ? [
          {
            key: "highlights" as const,
            label: "Highlights",
            icon: Icons.highlight,
            count: highlights.length,
            content: (
              <HighlightsPanel
                highlights={highlights}
                sections={sections}
                editingId={editingId}
                onEdit={setEditingId}
                onSetComment={saveComment}
                onRemove={(id) => void removeHighlight({ highlightId: id }).catch((err) => setNotice(errorMessage(err)))}
                onJump={(h) =>
                  viewer.current?.jumpTo(h.locator.page, {
                    y: h.segments.find((s) => s.page === h.locator.page)?.rects[0]?.y,
                    flashId: h._id,
                  })
                }
              />
            ),
          },
        ]
      : []),
    { key: "more" as const, label: "More", icon: MORE_ICON, content: <MoreTools /> },
  ];

  return (
    <div className="relative flex h-dvh" onMouseMove={wake} onFocusCapture={wake}>
      <header
        onMouseEnter={() => (overMenu.current = true)}
        onMouseLeave={() => (overMenu.current = false)}
        className={`absolute inset-x-0 top-0 z-30 flex items-center gap-2.5 border-b border-line bg-card/95 px-4 py-3 backdrop-blur transition duration-300 ${
          menuShown ? "" : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        <Link href={`/read/${doc._id}`} className="retro">
          ← Path
        </Link>
        <button className="retro" aria-expanded={contentsOpen} aria-controls="contents" onClick={() => setContentsOpen((o) => !o)}>
          ☰ Contents
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-serif font-semibold" title={chapter ? readableTitle(chapter.title) : doc.title}>
            {chapter ? readableTitle(chapter.title) : doc.title}
          </p>
          {chapter && (
            <div className="mx-auto mt-1.5 h-1 max-w-[220px] overflow-hidden rounded-full bg-line" aria-label={`${chapterPct}% of this ${isParts ? "part" : "chapter"} read`}>
              <div className="h-full rounded-full bg-good" style={{ width: `${chapterPct}%` }} />
            </div>
          )}
        </div>
        {!canHighlight && <span className="hidden text-label text-muted lg:inline">Scanned PDF: highlights and chat are off</span>}
        <button className="retro" aria-expanded={studyOpen} aria-controls="right-panel" onClick={() => setStudyOpen((o) => !o)} title="Ask, Notes, Highlights and more">
          📚 Study tools
        </button>
      </header>

      {contentsOpen && (
        <aside id="contents" className="h-full w-[340px] shrink-0 border-r-[1.5px] border-ink bg-cream pt-[60px]">
          <ContentsPanel sections={sections} ranges={ranges} readKeys={readKeys} page={page} onJump={jumpToPage} onClose={() => setContentsOpen(false)} />
        </aside>
      )}

      <div className="relative flex min-w-0 flex-1">
        <PdfViewer
          ref={viewer}
          url={url}
          pageCount={pageCount}
          zoom={ZOOMS[zoomIndex]}
          initialPage={initialPage}
          highlights={highlights}
          onPageChange={setPage}
          onSelection={canHighlight ? setSelection : undefined}
          onVisiblePages={onVisiblePages}
          onError={onError}
        />
        <PageNav
          page={page}
          pageCount={pageCount}
          onGo={jumpToPage}
          zoomPercent={zoomPercent}
          canZoomOut={zoomIndex > 0}
          canZoomIn={zoomIndex < ZOOMS.length - 1}
          onZoomOut={() => setZoomIndex((i) => Math.max(0, i - 1))}
          onZoomIn={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
        />
        {endNotice !== null && ranges[endNotice] && (
          <ChapterEndNotice
            range={ranges[endNotice]}
            number={chapterBadge(ranges[endNotice].title, endNotice, isParts)}
            isPart={isParts}
            onClose={() => setEndNotice(null)}
            onNote={() => {
              noteFor(ranges[endNotice].key);
              setEndNotice(null);
            }}
            testHref={`/read/${doc._id}/test?chapter=${encodeURIComponent(ranges[endNotice].key)}`}
            read={readKeys.has(ranges[endNotice].key)}
          />
        )}
      </div>

      {studyOpen && <RightPanel tab={studyTab} onTab={setStudyTab} tabs={tabs} onClose={() => setStudyOpen(false)} />}

      {reflections.activeKey && reflections.expanded && <NoteWindow state={reflections} />}
      {selection && (
        <SelectionMenu
          selection={selection}
          onHighlight={() => void createHighlight(false)}
          onComment={() => void createHighlight(true)}
          onAsk={() => {
            // Take the selected text to the chat; the reader edits it and sends it.
            setChatDraft(`Explain this: "${selection.text.slice(0, 600)}"`);
            openStudy("ask");
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
      {notice && (
        <p role="alert" className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-ui text-paper shadow-lg">
          {notice}
        </p>
      )}
    </div>
  );
}
