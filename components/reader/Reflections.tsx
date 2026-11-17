"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { validateNoteImage } from "@/convex/reflectionRules";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChapterRange } from "@/convex/chapters";
import { CitedText } from "./CitedText";
import { whenOf } from "./time";
import { readableTitle } from "./text";
import { NoteEditor, NoteValue } from "./NoteEditor";
import { SaveStatus, useAutosave } from "./useAutosave";

type Row = { _id: Id<"reflections">; sectionKey: string; content?: string; plainText?: string; dismissed: boolean };
const NO_ROWS: Row[] = [];

// State shared by the panel, the expanded window and the end-of-chapter prompt.
export function useReflections(documentId: Id<"documents">, ranges: ChapterRange[], onJump: (page: number) => void, canValidate: boolean) {
  const rows = useQuery(api.reflections.list, { documentId }) ?? NO_ROWS;
  const saveMutation = useMutation(api.reflections.save);
  const dismissMutation = useMutation(api.reflections.dismiss);
  const validate = useAction(api.chat.validateNote);
  const imageUploadUrl = useMutation(api.reflections.imageUploadUrl);
  const attachImage = useMutation(api.reflections.attachImage);
  // Uploads an image for a note and returns its link (or why it failed).
  const addImage = useCallback(
    async (file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> => {
      const problem = validateNoteImage({ size: file.size, contentType: file.type });
      if (problem) return { ok: false, message: problem };
      try {
        const uploadUrl = await imageUploadUrl();
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("upload failed");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        return await attachImage({ documentId, storageId });
      } catch {
        return { ok: false, message: "That image didn't upload. Try again." };
      }
    },
    [imageUploadUrl, attachImage, documentId]
  );
  const [activeKey, setActiveKey] = useState<string | null>(null); // the chapter being written
  const [expanded, setExpanded] = useState(false);
  // The latest text typed locally, so expanding or minimizing never shows an older copy.
  const [draft, setDraft] = useState<({ key: string } & NoteValue) | null>(null);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.sectionKey, r])), [rows]);
  const titleOf = useCallback((key: string) => readableTitle(ranges.find((r) => r.key === key)?.title ?? ""), [ranges]);
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

  return { rows, byKey, activeKey, expanded, setExpanded, open, close, titleOf, initialFor, setDraft, save, dismiss, validate, addImage, onJump, canValidate, documentId };
}
export type ReflectionsState = ReturnType<typeof useReflections>;

const statusText: Record<SaveStatus, string> = { idle: "", saving: "Saving…", saved: "Saved", error: "Couldn't save. Trying again…" };

type CheckResult = Extract<Awaited<ReturnType<ReflectionsState["validate"]>>, { ok: true }>;

const statusLabel = { supported: "Matches the book", incorrect: "Not quite", not_in_book: "Not covered in these pages" } as const;
const statusMark = { supported: "✓", incorrect: "✗", not_in_book: "?" } as const;

function ValidationCard({ result, onJump, onClose }: { result: CheckResult; onJump: (page: number) => void; onClose: () => void }) {
  const { verdict, summary, checks } = result.result;
  const title = verdict === "accurate" ? "Looks accurate" : verdict === "has_issues" ? "A few things to check" : "Couldn't check this";
  return (
    <section aria-label="Validation" className="max-h-[45%] shrink-0 overflow-y-auto border-t border-line bg-paper p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button onClick={onClose} aria-label="Close validation" className="text-muted hover:text-ink">
          ✕
        </button>
      </div>
      {summary && (
        <p className="mt-1 text-muted">
          <CitedText text={summary} pages={result.pages} onJump={onJump} />
        </p>
      )}
      <ul className="mt-3 space-y-2.5">
        {checks.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className={`mt-0.5 w-4 shrink-0 text-center font-bold ${c.status === "supported" ? "text-good" : c.status === "incorrect" ? "text-bad" : "text-muted"}`}>
              {statusMark[c.status]}
            </span>
            <div className="min-w-0">
              <p>
                {c.claim} <span className="text-xs text-muted">· {statusLabel[c.status]}</span>
              </p>
              {c.correction && (
                <p className="mt-0.5 text-muted">
                  <CitedText text={c.correction} pages={result.pages} onJump={onJump} />
                </p>
              )}
              {c.citations.length > 0 && !c.correction && (
                <p className="mt-0.5">
                  <CitedText text={c.citations.map((n) => `[${n}]`).join("")} pages={result.pages} onJump={onJump} />
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// One chapter's note: the editor plus its saving and Validate. Remounted (by key) when the chapter changes or the note is expanded.
function NoteSession({ state, chapterKey, header }: { state: ReflectionsState; chapterKey: string; header: (status: SaveStatus) => React.ReactNode }) {
  const { status, schedule } = useAutosave<NoteValue>((value) => state.save(chapterKey, value));
  const [plain, setPlain] = useState(() => state.byKey.get(chapterKey)?.plainText ?? "");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function validate() {
    setChecking(true);
    setProblem(null);
    try {
      const res = await state.validate({ documentId: state.documentId, chapterKey, noteText: plain });
      if (res.ok) setResult(res);
      else setProblem(res.resetAt ? `You've used today's questions. The next one frees up ${whenOf(res.resetAt)}.` : res.message);
    } catch {
      setProblem("We couldn't check this note just now. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header(status)}
      <div className="min-h-[220px] flex-1 px-4 pb-2">
        <NoteEditor
          initial={state.initialFor(chapterKey)}
          autoFocus
          onChange={(value) => {
            state.setDraft({ key: chapterKey, ...value });
            setPlain(value.plainText);
            schedule(value);
          }}
          onAddImage={async (file) => {
            setProblem(null);
            const res = await state.addImage(file);
            if (res.ok) return res.url;
            setProblem(res.message);
            return null;
          }}
          actions={
            state.canValidate ? (
              <button
                type="button"
                onClick={() => void validate()}
                disabled={checking || !plain.trim()}
                title="Checks your note against the book. Uses one of your 5 questions today."
                className="inline-flex items-center gap-1.5 rounded-lg border border-good-line bg-card px-3 py-1.5 text-[13px] font-semibold text-good hover:bg-good-soft disabled:opacity-50"
              >
                ✓ {checking ? "Checking…" : result ? "Check again" : "Check against the book"}
              </button>
            ) : undefined
          }
        />
      </div>
      {problem && (
        <p role="alert" className="shrink-0 border-t border-line px-4 py-2 text-sm text-bad">
          {problem}
        </p>
      )}
      {result && <ValidationCard result={result} onJump={state.onJump} onClose={() => setResult(null)} />}
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
          <div className="shrink-0 px-4 pb-3 pt-3">
            <div className="flex items-center gap-2">
              <button onClick={state.close} className="text-[13px] font-semibold text-accent hover:text-accent-dark" aria-label="Back to all notes">
                ‹ All notes
              </button>
              <span className="ml-auto text-xs text-muted" aria-live="polite">
                {statusText[status]}
              </span>
              <button onClick={() => state.setExpanded(true)} aria-label="Expand note" title="Open larger" className={iconButton}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              </button>
            </div>
            <h2 className="mt-1.5 font-serif text-lg font-bold leading-snug">{state.titleOf(key)}</h2>
            <p className="mt-0.5 text-[13px] text-muted">Write what you took away, in your own words. A few lines is enough.</p>
          </div>
        )}
      />
    );
  }

  const written = ranges.filter((r) => { const row = state.byKey.get(r.key); return !!row?.plainText?.trim() || !!row?.content?.includes('"type":"image"'); });
  // One text size (14 px) across the panel; weight and colour do the work instead.
  return (
    <div className="space-y-5 p-4 text-sm">
      <div className="rounded-xl border border-line bg-card p-3.5">
        <label htmlFor="reflect-on" className="block font-serif font-bold">
          Write a note
        </label>
        <p className="mb-2.5 mt-0.5 text-muted">What you took away from a chapter, in your own words.</p>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <select
              id="reflect-on"
              value={choice}
              onChange={(e) => setPick(e.target.value)}
              className="h-10 w-full appearance-none truncate rounded-lg border border-line bg-cream py-2 pl-3 pr-9 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {ranges.map((r) => (
                <option key={r.key} value={r.key}>
                  {readableTitle(r.title)}
                  {r.key === currentKey ? " · you're here" : ""}
                </option>
              ))}
            </select>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <button onClick={() => state.open(choice)} className="btn-primary h-10 shrink-0 text-sm">
            ✏️ Write
          </button>
        </div>
      </div>

      <section>
        <h2 className="mb-2.5 font-serif font-bold">
          Your notes <span className="font-sans font-normal text-muted">· {written.length}</span>
        </h2>
        {written.length === 0 ? (
          <p className="text-muted">Nothing yet. At the end of a chapter, write what you took away.</p>
        ) : (
          <ul className="space-y-2.5">
            {written.map((r) => (
              <li key={r.key}>
                <button
                  onClick={() => state.open(r.key)}
                  title="Open this note"
                  className="block w-full rounded-xl border border-line border-l-4 border-l-accent bg-card px-3.5 py-3 text-left transition hover:border-accent hover:shadow-sm"
                >
                  <span className="block truncate font-serif font-bold">{readableTitle(r.title)}</span>
                  <span className="mt-1 line-clamp-2 text-muted">{notePreview(state.byKey.get(r.key)?.plainText) || "🖼 Image"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// The first lines of a note on one line each joined by " · ", without the empty lines lists leave behind.
function notePreview(text?: string): string {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ");
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
