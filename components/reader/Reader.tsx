"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { Logo } from "@/components/Logo";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { chapterOf, chapterRanges, finishedChapter } from "@/convex/chapters";
import { ContentsPanel } from "./ContentsPanel";
import { HighlightsPanel } from "./HighlightsPanel";
import { PdfViewer, PdfViewerHandle, SelectionInfo } from "./PdfViewer";
import { ChatPanel, useChat } from "./Chat";
import { ChapterPrompt, NoteWindow, ReflectionsPanel, useReflections } from "./Reflections";
import { RightPanel, RightTab } from "./RightPanel";
import { SelectionMenu } from "./SelectionMenu";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const NO_HIGHLIGHTS: Doc<"highlights">[] = [];

type ReaderDoc = {
  _id: Id<"documents">;
  title: string;
  pageCount?: number;
  hasText?: boolean;
  sections?: { key: string; title: string; level: number; locator: { kind: "pdf"; page: number } }[];
  lastLocator?: { kind: "pdf"; page: number };
};
type Panel = "contents" | "highlights";

function RailButton({ label, badge, dot, active, onClick, controls, children }: { label: string; badge?: number; dot?: boolean; active: boolean; onClick: () => void; controls: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      aria-controls={controls}
      className={`relative flex w-12 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium ${
        active ? "bg-accent-soft" : "text-muted hover:bg-accent-soft hover:text-ink"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
      {label}
      {dot && <span aria-label="Reflection waiting" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />}
      {!!badge && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-accent px-1 text-[9px] font-semibold leading-4 text-paper">{badge}</span>}
    </button>
  );
}

export function Reader({ doc, url }: { doc: ReaderDoc; url: string }) {
  const pageCount = doc.pageCount ?? 1;
  const initialPage = doc.lastLocator?.page ?? 1;
  const canHighlight = doc.hasText !== false;
  const sections = useMemo(() => doc.sections ?? [], [doc.sections]);
  const ranges = useMemo(() => chapterRanges(sections, pageCount), [sections, pageCount]);

  const saveProgress = useMutation(api.documents.saveProgress);
  const addHighlight = useMutation(api.highlights.add);
  const setComment = useMutation(api.highlights.setComment);
  const removeHighlight = useMutation(api.highlights.remove);
  const highlights = useQuery(api.highlights.list, canHighlight ? { documentId: doc._id } : "skip") ?? NO_HIGHLIGHTS;

  const viewer = useRef<PdfViewerHandle>(null);
  const jumpToPage = useCallback((p: number) => viewer.current?.jumpTo(p), []);
  const reflections = useReflections(doc._id, ranges, jumpToPage, canHighlight);
  const chat = useChat(doc._id);
  const [chatDraft, setChatDraft] = useState("");
  const [page, setPage] = useState(initialPage);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [panel, setPanel] = useState<Panel | null>(null); // the left overlay starts closed
  const [rightOpen, setRightOpen] = useState(false); // so does the right panel
  const [rightTab, setRightTab] = useState<RightTab>(canHighlight ? "chat" : "reflections");
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [editingId, setEditingId] = useState<Id<"highlights"> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const onError = useCallback(() => setFailed(true), []);
  const togglePanel = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const toggleRight = (tab: RightTab) => {
    if (rightOpen && rightTab === tab) setRightOpen(false);
    else {
      setRightTab(tab);
      setRightOpen(true);
      if (tab === "reflections" && prompt) reflectOnPrompt(); // a waiting prompt opens its note
    }
  };

  // After finishing a chapter by reading (not by jumping), offer to write a reflection, once per chapter.
  const [prompt, setPrompt] = useState<{ key: string; tucked: boolean } | null>(null);
  const previousBottom = useRef<number | null>(null);
  const haveRow = useRef(reflections.byKey);
  useEffect(() => {
    haveRow.current = reflections.byKey;
  }, [reflections.byKey]);
  const onReadProgress = useCallback(
    (bottom: number, natural: boolean) => {
      const previous = previousBottom.current;
      previousBottom.current = bottom;
      if (previous === null || !natural) return;
      const done = finishedChapter(previous, bottom, ranges);
      if (!done || haveRow.current.has(done.key)) return; // already written, or "not now" was chosen
      setPrompt((cur) => (cur?.key === done.key ? cur : { key: done.key, tucked: false }));
    },
    [ranges]
  );
  const promptKey = prompt && !reflections.byKey.has(prompt.key) ? prompt.key : null;
  useEffect(() => {
    if (!prompt || prompt.tucked) return;
    const timer = window.setTimeout(() => setPrompt((cur) => (cur ? { ...cur, tucked: true } : cur)), 15000);
    return () => window.clearTimeout(timer);
  }, [prompt]);
  function reflectOnPrompt() {
    if (!prompt) return;
    reflections.open(prompt.key);
    setRightTab("reflections");
    setRightOpen(true);
    setPrompt(null);
  }

  // Esc closes the left overlay, then the right panel, unless the reader is typing somewhere (that field handles Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || reflections.expanded) return; // the larger note handles its own Esc
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) return;
      if (panel) setPanel(null);
      else if (rightOpen) setRightOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, rightOpen, reflections.expanded]);

  // Remember the page a moment after the reader stops moving.
  const saved = useRef(initialPage);
  useEffect(() => {
    if (page === saved.current) return;
    const timer = window.setTimeout(() => {
      saved.current = page;
      void saveProgress({ documentId: doc._id, page }).catch(() => {});
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [page, doc._id, saveProgress]);

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
        setPanel("highlights");
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
        <Link href="/read" className="btn-ghost">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-paper px-4">
        <Link href="/read" aria-label="Back to upload">
          <Logo size={24} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{doc.title}</h1>
        {!canHighlight && <span className="hidden text-xs text-muted sm:inline">Scanned PDF: highlights and chat are off</span>}
        <span className="text-sm tabular-nums text-muted" aria-live="off">
          {page} / {pageCount}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="btn-ghost px-2.5 py-1"
          >
            −
          </button>
          <span className="w-12 text-center text-sm tabular-nums text-muted">{Math.round(ZOOMS[zoomIndex] * 100)}%</span>
          <button
            onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOMS.length - 1}
            aria-label="Zoom in"
            className="btn-ghost px-2.5 py-1"
          >
            +
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-paper pt-3">
          <RailButton label="Contents" active={panel === "contents"} onClick={() => togglePanel("contents")} controls="left-panel">
            <path d="M4 6h16M4 12h10M4 18h13" />
          </RailButton>
          {canHighlight && (
            <RailButton label="Highlights" badge={highlights.length} active={panel === "highlights"} onClick={() => togglePanel("highlights")} controls="left-panel">
              <path d="m9 11-6 6v3h9l3-3" />
              <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
            </RailButton>
          )}
        </div>

        <div className="relative flex min-w-0 flex-1">
          {/* Clicking the book closes the left overlay. */}
          <div className="flex min-w-0 flex-1" onPointerDownCapture={() => panel && setPanel(null)}>
            <PdfViewer
              ref={viewer}
              url={url}
              pageCount={pageCount}
              zoom={ZOOMS[zoomIndex]}
              initialPage={initialPage}
              highlights={highlights}
              onPageChange={setPage}
              onSelection={canHighlight ? setSelection : undefined}
              onReadProgress={onReadProgress}
              onError={onError}
            />
          </div>
          {promptKey && prompt && !prompt.tucked && (
            <ChapterPrompt
              title={reflections.titleOf(promptKey)}
              onReflect={reflectOnPrompt}
              onNotNow={() => {
                void reflections.dismiss(promptKey);
                setPrompt(null);
              }}
            />
          )}
          {panel && (
            <div id="left-panel" className="absolute inset-y-0 left-0 z-20 shadow-xl">
              {panel === "contents" ? (
                <ContentsPanel
                  sections={sections}
                  page={page}
                  onJump={(p) => {
                    viewer.current?.jumpTo(p);
                    setPanel(null); // out of the way of the page you just opened
                  }}
                />
              ) : (
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
              )}
            </div>
          )}
        </div>

        {rightOpen && (
          <RightPanel
            tab={rightTab}
            onTab={setRightTab}
            chatAvailable={canHighlight}
            chat={<ChatPanel chat={chat} page={page} draft={chatDraft} onDraft={setChatDraft} onJump={jumpToPage} />}
            reflections={<ReflectionsPanel state={reflections} ranges={ranges} currentKey={chapterOf(sections, page)?.key ?? null} />}
          />
        )}
        <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-l border-line bg-paper pt-3">
          {canHighlight && (
            <RailButton label="Chat" active={rightOpen && rightTab === "chat"} onClick={() => toggleRight("chat")} controls="right-panel">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </RailButton>
          )}
          <RailButton label="Reflect" dot={!!promptKey && !!prompt?.tucked} active={rightOpen && rightTab === "reflections"} onClick={() => toggleRight("reflections")} controls="right-panel">
            <path d="M12 20h9" />
            <path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </RailButton>
        </div>
      </div>

      {reflections.activeKey && reflections.expanded && <NoteWindow state={reflections} />}
      {selection && (
        <SelectionMenu
          selection={selection}
          onHighlight={() => void createHighlight(false)}
          onComment={() => void createHighlight(true)}
          onAsk={() => {
            // Take the selected text to the chat; the reader edits it and sends it.
            setChatDraft(`Explain this: "${selection.text.slice(0, 600)}"`);
            setRightTab("chat");
            setRightOpen(true);
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
      {notice && (
        <p role="alert" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-paper shadow-lg">
          {notice}
        </p>
      )}
    </div>
  );
}
