"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { readableTitle } from "@/components/reader/text";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ChapterRange, SectionLike } from "@/convex/chapters";
import { MAX_COMMENT } from "@/convex/highlightRules";
import { formatTime, GENERAL, notebookGroups, NotebookFilter, NotebookItem } from "@/convex/notebookRules";
import { ComposeWindow } from "./Compose";
import { NoteRow, NotebookState, SavedRow } from "./useNotebook";

type Highlight = Doc<"highlights">;
type Item =
  | (NotebookItem & { kind: "note"; row: NoteRow })
  | (NotebookItem & { kind: "highlight"; row: Highlight })
  | (NotebookItem & { kind: "saved"; row: SavedRow });

const FILTERS: { key: NotebookFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "notes", label: "Notes" },
  { key: "highlights", label: "Highlights" },
  { key: "saved", label: "Saved" },
];

const rangeOf = (ranges: ChapterRange[], page: number) => ranges.find((r) => page >= r.startPage && page <= r.endPage)?.key ?? null;
const hasImage = (content: string) => content.includes('"type":"image"');

export type NotebookProps = {
  state: NotebookState;
  highlights: Highlight[];
  ranges: ChapterRange[];
  sections: (SectionLike & { title: string })[];
  currentKey: string | null; // the chapter the reader is in
  single: boolean; // article or video: one "chapter", no scope switch or chapter picker
  unit?: "chapter" | "part";
  canValidate: boolean;
  wide: boolean;
  citeUnit?: "p." | "§";
  editingId: Id<"highlights"> | null; // a highlight whose comment is being written
  onEditComment: (id: Id<"highlights"> | null) => void;
  onSetComment: (id: Id<"highlights">, comment: string) => void;
  onRemoveHighlight: (id: Id<"highlights">) => void;
  onJumpHighlight: (h: Highlight) => void;
  onJumpPage: (page: number) => void;
  onSeek?: (seconds: number) => void; // videos
  onExport?: () => void;
  onNotice: (message: string) => void;
  emptyHint: string; // what to do when there's nothing yet
};

// The Notebook tab: notes, highlights (with comments) and saved questions in one list, for this chapter or the
// whole book. Writing and editing happen in the compose window pinned to the bottom of the drawer.
export function NotebookPanel(p: NotebookProps) {
  const { state, ranges, single } = p;
  const [scope, setScope] = useState<"chapter" | "book">(single || !p.currentKey ? "book" : "chapter");
  const [filter, setFilter] = useState<NotebookFilter>("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const unit = p.unit ?? "chapter";
  const chapterKey = scope === "chapter" ? p.currentKey : null;
  const chapterTitle = p.currentKey ? readableTitle(ranges.find((r) => r.key === p.currentKey)?.title ?? "") : "";

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const n of state.notes)
      out.push({ kind: "note", id: n._id, chapterKey: single ? (ranges[0]?.key ?? null) : n.sectionKey, text: n.plainText, order: n.seconds ?? n._creationTime, row: n });
    for (const h of p.highlights) {
      const y = h.range ? h.range.startOffset : (h.segments.find((s) => s.page === h.locator.page)?.rects[0]?.y ?? 0);
      out.push({ kind: "highlight", id: h._id, chapterKey: rangeOf(ranges, h.locator.page), text: h.text, comment: h.comment, order: h.locator.page * 1e6 + y * (h.range ? 1 : 1e5), row: h });
    }
    for (const s of state.saved) out.push({ kind: "saved", id: s._id, chapterKey: s.chapterKey, text: `${s.question} ${s.rightAnswer}`, order: s._creationTime, row: s });
    return out;
  }, [state.notes, state.saved, p.highlights, ranges, single]);

  const groups = useMemo(() => notebookGroups(items, ranges, p.sections, filter, query), [items, ranges, p.sections, filter, query]);
  const shown = scope === "chapter" ? groups.filter((g) => g.key === chapterKey) : groups;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of notebookGroups(items, ranges, p.sections, "all")) m.set(g.key, g.items.length);
    return m;
  }, [items, ranges, p.sections]);

  // N writes a note (when not typing somewhere).
  const write = state.write;
  const writeKey = single ? (ranges[0]?.key ?? null) : p.currentKey;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      write(writeKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [write, writeKey]);

  function jumpTo(key: string) {
    setScope("book");
    requestAnimationFrame(() => document.getElementById(`nb-${key}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  const empty = state.loaded && shown.length === 0;
  return (
    <div className="relative flex h-full min-h-0">
      {p.wide && !single && (
        <nav aria-label="Jump to" className="w-[210px] shrink-0 overflow-y-auto border-r border-line px-2 pb-5 pt-2 text-meta">
          <p className="px-2 pb-1 pt-1 text-label font-bold uppercase tracking-[0.08em] text-muted">Jump to</p>
          <OutlineLink label="General notes" count={counts.get(GENERAL) ?? 0} onClick={() => jumpTo(GENERAL)} />
          {ranges.map((r) => (
            <OutlineLink key={r.key} label={readableTitle(r.title)} count={counts.get(r.key) ?? 0} current={r.key === p.currentKey} onClick={() => jumpTo(r.key)} />
          ))}
        </nav>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-3">
          {!single && p.currentKey ? (
            <div role="tablist" aria-label="Show" className="seg max-w-[260px] flex-1">
              <button role="tab" aria-selected={scope === "chapter"} onClick={() => setScope("chapter")} title={chapterTitle} className="!py-1 !text-label">
                This {unit}
              </button>
              <button role="tab" aria-selected={scope === "book"} onClick={() => setScope("book")} className="!py-1 !text-label">
                Whole book
              </button>
            </div>
          ) : (
            <span className="text-meta font-semibold text-muted">{single ? "Your notes and highlights" : "Whole book"}</span>
          )}
          <button
            className="icon-btn ml-auto"
            aria-label="Search the Notebook"
            aria-expanded={searching}
            title="Search"
            onClick={() => {
              setSearching((s) => !s);
              if (searching) setQuery("");
            }}
          >
            ⌕
          </button>
          {p.onExport && (
            <button className="quiet" onClick={p.onExport} title="Download or copy your notes">
              ⤓ Export
            </button>
          )}
        </div>
        {searching && (
          <div className="shrink-0 px-4 pb-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes, highlights and questions" aria-label="Search the Notebook" className="input py-1.5 text-meta" />
          </div>
        )}
        <div role="group" aria-label="Filter" className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2.5">
          {FILTERS.map((f) => (
            <button key={f.key} className="chip !py-0.5" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div ref={listRef} className={`min-h-0 flex-1 overflow-y-auto border-t border-line pb-6 ${p.wide ? "px-7" : "px-4"}`}>
          {!state.loaded ? (
            <p className="empty-note">Loading…</p>
          ) : empty ? (
            <p className="empty-note">
              {query.trim()
                ? `Nothing matches “${query.trim()}”.`
                : filter === "saved"
                  ? "No saved questions yet. After a wrong answer in a test, press 📓 Save to notes."
                  : filter === "highlights"
                    ? "No highlights yet. Select text and press 🖍 Highlight."
                    : p.emptyHint}
            </p>
          ) : (
            shown.map((g, i) => {
              const showPart = scope === "book" && g.part && g.part !== shown[i - 1]?.part;
              return (
                <section key={g.key} id={`nb-${g.key}`} aria-label={g.title} className="scroll-mt-2">
                  {showPart && <p className="mb-1.5 mt-4 font-game text-label text-accent-dark">{g.part}</p>}
                  {(scope === "book" && !single) && (
                    <h3 className="sticky top-0 z-[1] flex items-baseline gap-2 bg-cream pb-1.5 pt-2.5 font-serif text-ui font-bold">
                      <span className="min-w-0 truncate">{g.key === GENERAL ? "General notes" : readableTitle(g.title)}</span>
                      <span className="shrink-0 font-sans text-label font-semibold text-muted">{g.items.length}</span>
                    </h3>
                  )}
                  <ul className="grid gap-2 pt-1.5">
                    {g.items.map((item) => (
                      <li key={item.id}>
                        {item.kind === "note" ? (
                          <NoteCard note={item.row} state={state} onSeek={p.onSeek} onNotice={p.onNotice} />
                        ) : item.kind === "highlight" ? (
                          <HighlightCard h={item.row} {...p} />
                        ) : (
                          <SavedCard s={item.row} state={state} onJumpPage={p.onJumpPage} citeUnit={p.citeUnit ?? "p."} />
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
        <div className="shrink-0 border-t border-line bg-cream px-4 pb-3.5 pt-3">
          <button className="chunky w-full" onClick={() => write(writeKey)}>
            ✏️ Write a note
          </button>
          <p className="mt-1.5 truncate text-center text-label text-muted">
            {single ? "Goes to your notes" : p.currentKey ? `Goes to ${chapterTitle}` : "Goes to General notes"} · or press N
          </p>
        </div>
      </div>
      <ComposeWindow
        state={state}
        ranges={ranges}
        single={single}
        canValidate={p.canValidate}
        onJump={p.onJumpPage}
        onSaved={p.onNotice}
      />
    </div>
  );
}

function OutlineLink({ label, count, current, onClick }: { label: string; count: number; current?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left hover:bg-panel ${count ? "" : "text-[#a9998a]"} ${current ? "font-semibold text-accent-dark" : ""}`}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count > 0 && <span className="text-label text-muted">{count}</span>}
    </button>
  );
}

const card = "group rounded-xl border border-line bg-card px-3 py-2.5";
const actBtn = "rounded-md px-1.5 py-0.5 text-label text-muted hover:bg-panel hover:text-ink";

function NoteCard({ note, state, onSeek, onNotice }: { note: NoteRow; state: NotebookState; onSeek?: (s: number) => void; onNotice: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Lists leave empty lines in the plain copy; the card shows one line per item.
  const text = note.plainText.replace(/\n\s*\n+/g, "\n").trim() || (hasImage(note.content) ? "🖼 Image" : "");
  const long = text.length > 240 || text.split("\n").length > 4;
  return (
    <article className={card}>
      <div className="mb-1 flex items-center gap-2 text-label text-muted">
        <span>✏️ Note</span>
        {note.seconds !== null &&
          (onSeek ? (
            <button className="go" onClick={() => onSeek(note.seconds!)} title="Play from here">
              ▶ {formatTime(note.seconds)}
            </button>
          ) : (
            <span>{formatTime(note.seconds)}</span>
          ))}
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button className={actBtn} onClick={() => state.edit(note)}>
            Edit
          </button>
          <button className={`${actBtn} hover:text-bad`} onClick={() => setConfirm(true)}>
            Delete
          </button>
        </span>
      </div>
      <p className={`whitespace-pre-wrap text-meta leading-relaxed ${open ? "" : "line-clamp-4"}`}>{text}</p>
      {long && (
        <button className="mt-1 text-label font-semibold text-accent-dark hover:underline" onClick={() => setOpen((o) => !o)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
      <ConfirmDialog
        open={confirm}
        title="Delete this note?"
        message="This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          state.removeNote(note._id).then(() => onNotice("Note deleted"), () => onNotice("We couldn't delete that note. Try again."));
        }}
      />
    </article>
  );
}

function HighlightCard({ h, editingId, onEditComment, onSetComment, onRemoveHighlight, onJumpHighlight, citeUnit }: { h: Highlight } & NotebookProps) {
  const [confirm, setConfirm] = useState(false);
  const editing = editingId === h._id;
  return (
    <article className={card}>
      <div className="mb-1 flex items-center gap-2 text-label text-muted">
        <span>🖍 Highlight</span>
        <button className="go" onClick={() => onJumpHighlight(h)} title="Show it in the text">
          {citeUnit ?? "p."}
          {citeUnit === "§" ? "" : " "}
          {h.locator.page} ↗
        </button>
        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {!editing && (
            <button className={actBtn} onClick={() => onEditComment(h._id)}>
              💬 {h.comment ? "Edit comment" : "Comment"}
            </button>
          )}
          <button className={`${actBtn} hover:text-bad`} onClick={() => (h.comment ? setConfirm(true) : onRemoveHighlight(h._id))}>
            Delete
          </button>
        </span>
      </div>
      <blockquote className="line-clamp-6 border-l-[3px] border-[#e2bd52] pl-2.5 font-serif text-ui leading-normal">{h.text}</blockquote>
      {editing ? (
        <CommentEditor initial={h.comment ?? ""} onSave={(text) => onSetComment(h._id, text)} onCancel={() => onEditComment(null)} />
      ) : (
        h.comment && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-panel px-2.5 py-1.5 text-meta">{h.comment}</p>
      )}
      <ConfirmDialog
        open={confirm}
        title="Delete this highlight?"
        message="Its comment will be deleted too. This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onRemoveHighlight(h._id);
        }}
      />
    </article>
  );
}

function CommentEditor({ initial, onSave, onCancel }: { initial: string; onSave: (text: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <textarea
      autoFocus
      rows={2}
      maxLength={MAX_COMMENT}
      value={value}
      aria-label="Comment"
      placeholder="Your thoughts… (Enter to save)"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave(value);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="input mt-2 resize-none text-meta"
    />
  );
}

function SavedCard({ s, state, onJumpPage, citeUnit }: { s: SavedRow; state: NotebookState; onJumpPage: (page: number) => void; citeUnit: string }) {
  return (
    <article className={card}>
      <div className="mb-1 flex items-center gap-2 text-label text-muted">
        <span>📓 Saved question</span>
        {s.page !== undefined && (
          <button className="go" onClick={() => onJumpPage(s.page!)}>
            {citeUnit} {s.page} ↗
          </button>
        )}
        <span className="ml-auto opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button className={`${actBtn} hover:text-bad`} onClick={() => void state.removeQuestion(s._id)}>
            Remove
          </button>
        </span>
      </div>
      <p className="font-serif text-ui font-semibold leading-snug">{s.question}</p>
      <p className="mt-1.5 text-meta">
        Your answer: <s className="text-accent-dark">{s.yourAnswer}</s>
      </p>
      <p className="text-meta">
        Right answer: <b className="text-good">{s.rightAnswer}</b>
      </p>
    </article>
  );
}
