"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/components/FieldError";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { BookCover } from "./BookCover";

export type LibraryBook = {
  _id: Id<"documents">;
  title: string;
  status: "processing" | "ready" | "failed";
  statusMessage?: string;
  pageCount: number;
  page: number | null;
  chapterNumber: number | null;
  chapterTitle: string | null;
  progress: number; // % of pages seen
  lastReadAt: number | null;
  sourceType: "pdf" | "article" | "video" | "epub" | "word" | "powerpoint";
  siteName: string | null;
  imageUrl: string | null;
  coverUrl: string | null;
  needsCover: boolean;
  folderId: Id<"folders"> | null;
};

export type FolderOption = { _id: Id<"folders">; name: string; colour: string; emoji: string };
// The drag payload for library items (ids as JSON), so folder drop targets can tell items from files.
export const ITEM_DRAG_TYPE = "application/x-ingrain-items";

// Where a library item opens: a book's chapter path, or straight into an article or video.
export const isBook = (b: { sourceType: LibraryBook["sourceType"] }) => b.sourceType === "pdf" || b.sourceType === "epub";
export const openHref = (b: LibraryBook) => (isBook(b) ? `/read/${b._id}` : `/read/${b._id}/book`);

export const progressOf = (b: LibraryBook) => b.progress;

function metaLine(b: LibraryBook): string {
  if (b.status === "processing") return b.sourceType === "pdf" ? "Preparing…" : "Adding…";
  if (b.status === "failed") return b.sourceType === "pdf" ? "Couldn't read this PDF" : "Couldn't read this file";
  if (b.sourceType === "word") return "Word";
  if (b.sourceType === "powerpoint") return `PowerPoint · ${b.pageCount} slide${b.pageCount === 1 ? "" : "s"}`;
  if (b.sourceType === "epub") return !b.page ? "EPUB · not started" : `EPUB${b.chapterNumber ? ` · Ch ${b.chapterNumber}` : ""} · ${b.progress}%`;
  if (b.sourceType === "article") return b.status === "ready" && b.statusMessage ? "Article · saved as a link" : `Article${b.siteName ? ` · ${b.siteName}` : ""}`;
  if (b.sourceType === "video") return `Video${b.siteName ? ` · ${b.siteName}` : ""}`;
  if (!b.page) return "Not started";
  return `p. ${b.page} of ${b.pageCount}${b.chapterNumber ? ` · Ch ${b.chapterNumber}` : ""}`;
}

// One item on the shelf. The ⋯ menu (on hover or keyboard focus) and right-click have Rename, Move to and Remove.
// Items can also be dragged onto a folder in the rail.
export function BookTile({
  book,
  onRemove,
  onError,
  folders,
  showFolder,
  onMove,
  onDragChange,
}: {
  book: LibraryBook;
  onRemove: (b: LibraryBook) => void;
  onError: (m: string) => void;
  folders: FolderOption[];
  showFolder: boolean; // in "All items", say which folder it's in
  onMove: (ids: Id<"documents">[], folderId: Id<"folders"> | null) => void;
  onDragChange: (dragging: boolean) => void;
}) {
  const rename = useMutation(api.documents.rename);
  const [menu, setMenu] = useState<false | "button" | { x: number; y: number }>(false);
  const folder = folders.find((f) => f._id === book.folderId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(book.title);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pct = progressOf(book);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrapRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menu]);

  function save() {
    setEditing(false);
    const title = draft.trim();
    if (!title || title === book.title) return setDraft(book.title);
    rename({ documentId: book._id, title }).catch((err) => {
      setDraft(book.title);
      onError(errorMessage(err));
    });
  }

  const openable = book.status === "ready";
  const body = (
    <>
      <BookCover
        id={book._id}
        title={book.title}
        meta={book.sourceType === "pdf" && book.pageCount ? `${book.pageCount} pages` : book.sourceType === "word" ? "Word" : book.sourceType === "powerpoint" ? "PowerPoint" : book.sourceType === "epub" ? "EPUB" : undefined}
        coverUrl={book.coverUrl}
        imageUrl={book.imageUrl}
        kind={book.sourceType}
        label={book.sourceType === "pdf" ? undefined : (book.siteName ?? undefined)}
        className="w-full text-ui transition-transform group-hover:-translate-y-1 group-hover:border-accent"
        badge={!book.lastReadAt && openable ? "New" : undefined}
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          maxLength={120}
          aria-label="Book title"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(book.title);
              setEditing(false);
            }
          }}
          className="input mt-2.5 border-accent py-1 font-semibold"
        />
      ) : (
        <div className="mt-2.5 line-clamp-2 font-semibold leading-snug group-hover:text-accent-dark" title={book.title}>
          {book.title}
        </div>
      )}
      <div className={`mt-0.5 truncate text-meta ${book.status === "failed" ? "text-bad" : "text-muted"}`}>{metaLine(book)}</div>
      {showFolder && folder && (
        <span className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-full border border-line bg-panel px-2 text-label font-semibold text-muted">
          {folder.emoji} {folder.name}
        </span>
      )}
      {isBook(book) && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
        </div>
      )}
    </>
  );

  return (
    <div
      ref={wrapRef}
      className="group relative"
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData(ITEM_DRAG_TYPE, JSON.stringify([book._id]));
        e.dataTransfer.effectAllowed = "move";
        onDragChange(true);
      }}
      onDragEnd={() => onDragChange(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: Math.min(e.clientX, window.innerWidth - 230), y: Math.min(e.clientY, window.innerHeight - 320) });
      }}
    >
      {openable && !editing ? (
        <Link href={openHref(book)} className="block rounded-lg" draggable={false}>
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
      <button
        aria-label={`More options for ${book.title}`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => setMenu((m) => (m ? false : "button"))}
        className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-card/95 text-h3 leading-none text-ink shadow-sm transition-opacity focus-visible:opacity-100 ${
          menu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        ⋯
      </button>
      {menu && (
        <div
          role="menu"
          aria-label={`Options for ${book.title}`}
          style={menu === "button" ? undefined : { left: menu.x, top: menu.y }}
          className={`${menu === "button" ? "absolute right-2 top-11" : "fixed"} z-30 max-h-[70vh] min-w-[210px] overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-lg`}
        >
          <button
            role="menuitem"
            autoFocus
            onClick={() => {
              setMenu(false);
              setDraft(book.title);
              setEditing(true);
            }}
            className="w-full rounded-lg px-2.5 py-2 text-left text-ui hover:bg-panel"
          >
            Rename
          </button>
          <div className="my-1 border-t border-line" />
          <p className="px-2.5 pb-1 pt-1 text-label font-bold uppercase tracking-[0.08em] text-muted">Move to</p>
          {folders.map((f) => (
            <button
              key={f._id}
              role="menuitem"
              disabled={f._id === book.folderId}
              onClick={() => {
                setMenu(false);
                onMove([book._id], f._id);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-meta hover:bg-panel disabled:cursor-default disabled:font-semibold disabled:text-accent-dark disabled:hover:bg-transparent"
            >
              <span aria-hidden="true">{f.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              {f._id === book.folderId && <span aria-label="current folder">✓</span>}
            </button>
          ))}
          <button
            role="menuitem"
            disabled={!book.folderId}
            onClick={() => {
              setMenu(false);
              onMove([book._id], null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-meta hover:bg-panel disabled:cursor-default disabled:font-semibold disabled:text-accent-dark disabled:hover:bg-transparent"
          >
            <span aria-hidden="true">·</span>
            <span className="flex-1">No folder</span>
            {!book.folderId && <span aria-label="current folder">✓</span>}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onRemove(book);
            }}
            className="w-full rounded-lg px-2.5 py-2 text-left text-ui text-accent-dark hover:bg-panel"
          >
            Remove from library
          </button>
        </div>
      )}
    </div>
  );
}
