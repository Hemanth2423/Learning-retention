"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { errorMessage } from "@/components/FieldError";
import { NoteEditor } from "@/components/reader/NoteEditor";
import { readableTitle } from "@/components/reader/text";
import { whenOf } from "@/components/reader/time";
import { ChapterRange } from "@/convex/chapters";
import { formatTime } from "@/convex/notebookRules";
import { Compose, NotebookState } from "./useNotebook";
import { CheckResult, ValidationCard } from "./ValidationCard";

export function isDirty(c: Compose): boolean {
  if (!c.draft) return false;
  return c.noteId ? c.draft.content !== c.initial : !!c.draft.plainText.trim() || c.draft.content.includes('"type":"image"');
}

// The compose window (Gmail-style): docked in the bottom half of the drawer, minimised to a bar, or bigger over the
// book. Used for new notes and for editing. Closing with unsaved text asks first.
export function ComposeWindow({
  state,
  ranges,
  single,
  canValidate,
  onJump,
  onSaved,
}: {
  state: NotebookState;
  ranges: ChapterRange[];
  single: boolean; // an article or video: one "chapter", so no General notes / chapter picker
  canValidate: boolean;
  onJump: (page: number) => void;
  onSaved: (message: string) => void;
}) {
  const c = state.compose;
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const dirty = !!c && isDirty(c);

  // Leaving the page with an unsaved note: the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Esc: a bigger window goes back to the drawer; otherwise minimise. Never throws text away.
  useEffect(() => {
    if (!c || c.minimised) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || confirming) return;
      e.stopPropagation();
      state.patchCompose(c.big ? { big: false } : { minimised: true });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [c, confirming, state]);

  if (!c) return null;
  const where = c.sectionKey ? readableTitle(ranges.find((r) => r.key === c.sectionKey)?.title ?? "") : "General notes";
  const text = c.draft?.plainText ?? "";

  async function save() {
    if (!c) return;
    setSaving(true);
    setProblem(null);
    try {
      const res = await state.save(c);
      state.closeCompose();
      onSaved(res.noteId === null ? "Note deleted" : `Saved to ${single ? "your notes" : where}${res.xp ? ` · +${res.xp} XP` : ""}`);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function check() {
    if (!c?.sectionKey) return;
    setChecking(true);
    setProblem(null);
    try {
      const res = await state.validate({ documentId: state.documentId, chapterKey: c.sectionKey, noteText: text });
      if (res.ok) setResult(res);
      else setProblem(res.resetAt ? `You've used today's questions. The next one frees up ${whenOf(res.resetAt)}.` : res.message);
    } catch {
      setProblem("We couldn't check this note just now. Try again.");
    } finally {
      setChecking(false);
    }
  }

  const close = () => (dirty ? setConfirming(true) : state.closeCompose());
  const title = c.noteId ? "Edit note" : "New note";
  const confirm = (
    <ConfirmDialog
      open={confirming}
      title="Discard this note?"
      message="What you typed hasn't been saved."
      confirmLabel="Discard"
      onCancel={() => setConfirming(false)}
      onConfirm={() => {
        setConfirming(false);
        state.closeCompose();
      }}
    />
  );

  if (c.minimised) {
    return (
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t-2 border-ink bg-card px-4 py-2.5 shadow-[0_-8px_20px_-14px_rgba(42,34,27,.6)]">
        <button className="min-w-0 flex-1 truncate text-left text-ui font-semibold hover:text-accent-dark" onClick={() => state.patchCompose({ minimised: false })}>
          ✏️ {title} · <span className="font-normal text-muted">{text.trim() ? text.trim().slice(0, 60) : where}</span>
        </button>
        <button className="icon-btn" aria-label="Open the note again" title="Open" onClick={() => state.patchCompose({ minimised: false })}>
          ▴
        </button>
        <button className="icon-btn" aria-label="Close the note" title="Close" onClick={close}>
          ✕
        </button>
        {confirm}
      </div>
    );
  }

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line py-1.5 pl-4 pr-2">
        <h3 className="mr-auto font-serif text-ui font-bold">{title}</h3>
        <button className="icon-btn" aria-label="Minimise" title="Minimise (Esc)" onClick={() => state.patchCompose({ minimised: true, big: false })}>
          ▾
        </button>
        <button className="icon-btn" aria-label={c.big ? "Back to the drawer" : "Bigger window"} title={c.big ? "Back to the drawer" : "Bigger window"} onClick={() => state.patchCompose({ big: !c.big })}>
          {c.big ? "⤡" : "⤢"}
        </button>
        <button className="icon-btn" aria-label="Close" title="Close" onClick={close}>
          ✕
        </button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2 text-meta text-muted">
        {single ? (
          <span>On: {readableTitle(ranges[0]?.title ?? "")}</span>
        ) : (
          <label className="flex min-w-0 items-center gap-2">
            In:
            <select
              value={c.sectionKey ?? ""}
              onChange={(e) => state.patchCompose({ sectionKey: e.target.value || null })}
              className="min-w-0 max-w-[260px] truncate rounded-lg border border-line bg-cream px-2 py-1 text-meta text-ink focus:border-ink focus:outline-none"
            >
              <option value="">General notes</option>
              {ranges.map((r) => (
                <option key={r.key} value={r.key}>
                  {readableTitle(r.title)}
                </option>
              ))}
            </select>
          </label>
        )}
        {c.seconds !== null && <span className="rounded-md bg-panel px-1.5 font-semibold text-ink">⏱ {formatTime(c.seconds)}</span>}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-3">
        <NoteEditor
          key={c.noteId ?? "new"}
          initial={c.draft?.content ?? c.initial}
          autoFocus
          placeholder={c.sectionKey ? "What did you take away? A few sentences is enough." : "Anything about the book as a whole, a question, a link to your own work…"}
          onChange={(value) => state.patchCompose({ draft: value })}
          onAddImage={async (file) => {
            setProblem(null);
            const res = await state.addImage(file);
            if (res.ok) return res.url;
            setProblem(res.message);
            return null;
          }}
          actions={
            <>
              {canValidate && c.sectionKey && (
                <button
                  type="button"
                  onClick={() => void check()}
                  disabled={checking || !text.trim()}
                  title="Checks your note against this chapter. Uses one of your questions today."
                  className="quiet mr-auto border-good-line text-good hover:border-good"
                >
                  ✓ {checking ? "Checking…" : result ? "Check again" : "Check against the book"}
                </button>
              )}
              <button type="button" className="chunky sm" onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? "Saving…" : c.noteId ? "Save changes" : "Save note"}
              </button>
            </>
          }
        />
      </div>
      {problem && (
        <p role="alert" className="shrink-0 border-t border-line px-4 py-2 text-meta text-bad">
          {problem}
        </p>
      )}
      {result && <ValidationCard result={result} onJump={onJump} onClose={() => setResult(null)} />}
      {confirm}
    </div>
  );

  if (c.big) {
    return createPortal(
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && state.patchCompose({ big: false })}>
        <div role="dialog" aria-label={title} className="flex h-[80vh] w-[min(820px,100%)] flex-col overflow-hidden rounded-xl border-2 border-ink bg-card shadow-[0_6px_0_var(--ink)]">
          {body}
        </div>
      </div>,
      document.body
    );
  }
  return (
    <div role="dialog" aria-label={title} className="absolute inset-x-0 bottom-0 z-10 flex h-[58%] min-h-[320px] flex-col border-t-2 border-ink bg-card shadow-[0_-12px_28px_-18px_rgba(42,34,27,.7)]">
      {body}
    </div>
  );
}
