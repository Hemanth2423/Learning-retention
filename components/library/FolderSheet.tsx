"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "@/components/FieldError";
import { Id } from "@/convex/_generated/dataModel";
import { canHaveSubfolder, flattenFolders, MAX_FOLDER_NAME } from "@/convex/folderRules";
import { coverColour } from "./BookCover";
import { FolderOption, LibraryBook } from "./BookTile";

export type FolderSheetMode =
  | { kind: "create"; parentId: Id<"folders"> | null; preselect?: Id<"documents">[] }
  | { kind: "add"; folderId: Id<"folders"> };

const KIND: Record<LibraryBook["sourceType"], string> = { pdf: "PDF", epub: "EPUB", word: "Word", powerpoint: "PowerPoint", article: "Article", video: "Video" };

// One pop-up for filling folders, like adding songs to a playlist: search the library and press + on what belongs.
// "create" also names the new folder and picks where it lives.
export function FolderSheet({
  mode,
  books,
  folders,
  onClose,
  onCreate,
  onAdd,
}: {
  mode: FolderSheetMode;
  books: LibraryBook[];
  folders: FolderOption[];
  onClose: () => void;
  onCreate: (name: string, parentId: Id<"folders"> | null, ids: Id<"documents">[]) => Promise<void>;
  onAdd: (folderId: Id<"folders">, ids: Id<"documents">[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<Id<"folders"> | null>(mode.kind === "create" ? mode.parentId : null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<Id<"documents">>>(() => new Set(mode.kind === "create" ? mode.preselect : []));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const target = mode.kind === "add" ? folders.find((f) => f._id === mode.folderId) : undefined;

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const places = useMemo(() => flattenFolders(folders).filter((f) => canHaveSubfolder(folders, f._id)), [folders]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => !q || b.title.toLowerCase().includes(q) || (b.siteName ?? "").toLowerCase().includes(q));
  }, [books, query]);
  const folderName = (id: string | null) => folders.find((f) => f._id === id)?.name;

  function toggle(id: Id<"documents">) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (mode.kind === "create") await onCreate(name, parentId, [...picked]);
      else await onAdd(mode.folderId, [...picked]);
      onClose();
    } catch (err) {
      setProblem(errorMessage(err));
      setBusy(false);
    }
  }

  const n = picked.size;
  const canSubmit = mode.kind === "create" ? !!name.trim() : n > 0;
  const action = mode.kind === "create" ? (n ? `Create with ${n} item${n === 1 ? "" : "s"}` : "Create folder") : n ? `Add ${n} item${n === 1 ? "" : "s"}` : "Add items";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/45 px-4 py-10" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-sheet-title"
        className="flex max-h-[calc(100dvh-80px)] w-[min(600px,100%)] flex-col rounded-[18px] border-2 border-ink bg-card px-[22px] pb-5 pt-[18px] shadow-[0_6px_0_var(--ink)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h2 id="folder-sheet-title" className="min-w-0 truncate font-serif text-h2 font-bold">
            {mode.kind === "create" ? "New folder" : `Add to ${target?.name ?? "folder"}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
            ✕
          </button>
        </div>

        {mode.kind === "create" && (
          <div className="mt-3.5 grid shrink-0 gap-2.5 sm:grid-cols-[minmax(0,1fr)_200px]">
            <label className="block">
              <span className="text-label font-bold uppercase tracking-[0.08em] text-muted">Name</span>
              <input
                ref={firstRef}
                value={name}
                maxLength={MAX_FOLDER_NAME}
                onChange={(e) => {
                  setName(e.target.value);
                  setProblem(null);
                }}
                placeholder="e.g. AI engineering"
                className="input mt-1"
              />
            </label>
            <label className="block">
              <span className="text-label font-bold uppercase tracking-[0.08em] text-muted">Inside</span>
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId((e.target.value || null) as Id<"folders"> | null)}
                className="mt-1 h-[41px] w-full rounded-xl border-[1.5px] border-line bg-card px-2 text-ui focus:border-ink focus:outline-none"
              >
                <option value="">Library (top level)</option>
                {places.map((f) => (
                  <option key={f._id} value={f._id}>
                    {"  ".repeat(f.depth)}
                    {f.emoji} {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-3.5 shrink-0">
          <span className="text-label font-bold uppercase tracking-[0.08em] text-muted">{mode.kind === "create" ? "Add from your library (optional)" : "From your library"}</span>
          <input
            ref={mode.kind === "add" ? firstRef : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books, articles and videos"
            aria-label="Search your library"
            className="input mt-1"
          />
        </div>

        <ul className="mt-2.5 min-h-[120px] flex-1 space-y-0.5 overflow-y-auto" aria-label="Library items">
          {rows.map((b) => {
            const already = mode.kind === "add" && b.folderId === mode.folderId;
            const on = already || picked.has(b._id);
            const elsewhere = !already && b.folderId ? folderName(b.folderId) : undefined;
            const image = b.coverUrl ?? b.imageUrl;
            return (
              <li key={b._id}>
                <button
                  type="button"
                  disabled={already}
                  aria-pressed={on}
                  onClick={() => toggle(b._id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition ${on ? "bg-white" : "hover:bg-panel"} disabled:cursor-default`}
                >
                  <span className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-panel font-serif font-bold text-[#f6eedf]" style={image ? undefined : { background: coverColour(b._id) }}>
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
                    ) : (
                      b.title.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.title}</span>
                    <span className="block truncate text-meta text-muted">
                      {KIND[b.sourceType]}
                      {already ? " · already here" : elsewhere ? ` · moves from ${elsewhere}` : ""}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-[1.5px] text-h3 leading-none ${on ? "border-good bg-good text-white" : "border-[#c9b9a0] text-muted"}`}
                  >
                    {on ? "✓" : "+"}
                  </span>
                </button>
              </li>
            );
          })}
          {rows.length === 0 && <li className="empty-note">{books.length ? `Nothing matches “${query.trim()}”.` : "Your library is empty."}</li>}
        </ul>

        {problem && (
          <p role="alert" className="mt-2 shrink-0 text-meta font-semibold text-bad">
            {problem}
          </p>
        )}
        <div className="mt-3.5 flex shrink-0 items-center justify-between gap-3">
          <span className="text-meta text-muted">{n ? `${n} selected` : "An item lives in one folder."}</span>
          <button type="submit" className="chunky shrink-0" disabled={!canSubmit || busy}>
            {busy ? "Saving…" : action}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
