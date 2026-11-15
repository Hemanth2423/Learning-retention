"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChapterRange } from "@/convex/chapters";
import { NoteEditor, NoteValue } from "./NoteEditor";
import { SaveStatus, useAutosave } from "./useAutosave";

type Row = { _id: Id<"reflections">; sectionKey: string; content?: string; plainText?: string; dismissed: boolean };
const NO_ROWS: Row[] = [];

// State shared by the panel, the expanded window and the end-of-chapter prompt.
export function useReflections(documentId: Id<"documents">, ranges: ChapterRange[]) {
  const rows = useQuery(api.reflections.list, { documentId }) ?? NO_ROWS;
  const saveMutation = useMutation(api.reflections.save);
  const dismissMutation = useMutation(api.reflections.dismiss);
  const [activeKey, setActiveKey] = useState<string | null>(null); // the chapter being written
  const [expanded, setExpanded] = useState(false);
  // The latest text typed locally, so expanding or minimizing never shows an older copy.
  const [draft, setDraft] = useState<({ key: string } & NoteValue) | null>(null);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.sectionKey, r])), [rows]);
  const titleOf = useCallback((key: string) => ranges.find((r) => r.key === key)?.title ?? "", [ranges]);
  const initialFor = (key: string) => (draft?.key === key ? draft.content : (byKey.get(key)?.content ?? null));

  const save = useCallback((key: string, value: NoteValue) => saveMutation({ documentId, sectionKey: key, ...value }), [saveMutation, documentId]);
  const dismiss = useCallback((key: string) => dismissMutation({ documentId, sectionKey: key }).catch(() => {}), [dismissMutation, documentId]);
  const open = useCallback((key: string) => {
    setActiveKey(key);
  }, []);
  const close = useCallback(() => {
    setActiveKey(null);
    setExpanded(false);
  }, []);

  return { rows, byKey, activeKey, expanded, setExpanded, open, close, titleOf, initialFor, setDraft, save, dismiss };
}
export type ReflectionsState = ReturnType<typeof useReflections>;

const statusText: Record<SaveStatus, string> = { idle: "", saving: "Saving…", saved: "Saved", error: "Couldn't save. Trying again…" };

// One chapter's note: the editor plus its saving. Remounted (by key) when the chapter changes or the note is expanded.
function NoteSession({ state, chapterKey, header }: { state: ReflectionsState; chapterKey: string; header: (status: SaveStatus) => React.ReactNode }) {
  const { status, schedule } = useAutosave<NoteValue>((value) => state.save(chapterKey, value));
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header(status)}
      <div className="min-h-0 flex-1">
        <NoteEditor
          initial={state.initialFor(chapterKey)}
          autoFocus
          onChange={(value) => {
            state.setDraft({ key: chapterKey, ...value });
            schedule(value);
          }}
        />
      </div>
    </div>
  );
}

const iconButton = "flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-ink";

// The right panel's Reflections tab.
export function ReflectionsPanel({ state, ranges, currentKey }: { state: ReflectionsState; ranges: ChapterRange[]; currentKey: string | null }) {
  const [pick, setPick] = useState<string | null>(null);
  const choice = pick ?? currentKey ?? ranges[0]?.key ?? "";

  if (ranges.length === 0) {
    return <p className="p-4 text-sm text-muted">This PDF has no contents, so chapter reflections aren&apos;t available.</p>;
  }

  if (state.activeKey) {
    const key = state.activeKey;
    if (state.expanded) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted">Writing about “{state.titleOf(key)}” in the larger window.</p>
          <button onClick={() => state.setExpanded(false)} className="btn-ghost">
            Minimize
          </button>
        </div>
      );
    }
    return (
      <NoteSession
        key={`panel-${key}`}
        state={state}
        chapterKey={key}
        header={(status) => (
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
            <button onClick={state.close} className="text-sm text-muted hover:text-ink" aria-label="Back to all reflections">
              ‹ All
            </button>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{state.titleOf(key)}</h2>
            <span className="text-xs text-muted" aria-live="polite">
              {statusText[status]}
            </span>
            <button onClick={() => state.setExpanded(true)} aria-label="Expand note" title="Expand" className={iconButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          </div>
        )}
      />
    );
  }

  const written = ranges.filter((r) => state.byKey.get(r.key)?.plainText);
  return (
    <div className="p-4">
      <label htmlFor="reflect-on" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        Reflect on
      </label>
      <div className="flex gap-2">
        <select id="reflect-on" value={choice} onChange={(e) => setPick(e.target.value)} className="input min-w-0 flex-1">
          {ranges.map((r) => (
            <option key={r.key} value={r.key}>
              {r.title}
              {r.key === currentKey ? " (you are here)" : ""}
            </option>
          ))}
        </select>
        <button onClick={() => state.open(choice)} className="btn-primary shrink-0">
          Write
        </button>
      </div>

      <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Your reflections</h2>
      {written.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. After a chapter, write what you took away in your own words.</p>
      ) : (
        <ul className="space-y-2">
          {written.map((r) => (
            <li key={r.key}>
              <button onClick={() => state.open(r.key)} className="block w-full rounded-lg border border-line p-3 text-left hover:bg-accent-soft">
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="mt-1 line-clamp-3 block whitespace-pre-line text-sm text-muted">{state.byKey.get(r.key)?.plainText?.replace(/\n{2,}/g, "\n")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The larger note, floating over the book (like expanding a Gmail draft). Minimize returns it to the panel.
export function NoteWindow({ state }: { state: ReflectionsState }) {
  const key = state.activeKey;
  const { setExpanded } = state;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setExpanded]);
  if (!key) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && setExpanded(false)}>
      <div role="dialog" aria-label={`Reflection: ${state.titleOf(key)}`} className="flex h-[80vh] w-[min(820px,100%)] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-2xl">
        <NoteSession
          key={`window-${key}`}
          state={state}
          chapterKey={key}
          header={(status) => (
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5">
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{state.titleOf(key)}</h2>
              <span className="text-xs text-muted" aria-live="polite">
                {statusText[status]}
              </span>
              <button onClick={() => setExpanded(false)} aria-label="Minimize note" title="Minimize" className={iconButton}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
                </svg>
              </button>
            </div>
          )}
        />
      </div>
    </div>
  );
}

// The gentle prompt after finishing a chapter.
export function ChapterPrompt({ title, onReflect, onNotNow }: { title: string; onReflect: () => void; onNotNow: () => void }) {
  return (
    <div role="status" className="absolute bottom-4 right-4 z-10 w-72 rounded-xl border border-line bg-card p-4 shadow-lg">
      <p className="text-sm">
        You finished <span className="font-semibold">{title}</span>. What did you take away?
      </p>
      <div className="mt-3 flex gap-2">
        <button onClick={onReflect} className="btn-primary px-3 py-1.5">
          Reflect
        </button>
        <button onClick={onNotNow} className="btn-ghost px-3 py-1.5">
          Not now
        </button>
      </div>
    </div>
  );
}
