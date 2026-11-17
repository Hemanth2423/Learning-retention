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
};

export const progressOf = (b: LibraryBook) => b.progress;

function metaLine(b: LibraryBook): string {
  if (b.status === "processing") return "Preparing…";
  if (b.status === "failed") return "Couldn't read this PDF";
  if (!b.page) return "Not started";
  return `p. ${b.page} of ${b.pageCount}${b.chapterNumber ? ` · Ch ${b.chapterNumber}` : ""}`;
}

// One book on the shelf. The ⋯ menu (on hover or keyboard focus) has Rename and Remove.
export function BookTile({ book, onRemove, onError }: { book: LibraryBook; onRemove: (b: LibraryBook) => void; onError: (m: string) => void }) {
  const rename = useMutation(api.documents.rename);
  const [menu, setMenu] = useState(false);
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
      <BookCover id={book._id} title={book.title} pageCount={book.pageCount} className="aspect-[2/3] w-full transition-transform group-hover:-translate-y-1" badge={!book.page && openable ? "New" : undefined} />
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
        <div className="mt-2.5 line-clamp-2 font-semibold leading-snug" title={book.title}>
          {book.title}
        </div>
      )}
      <div className={`mt-0.5 text-[13px] ${book.status === "failed" ? "text-bad" : "text-muted"}`}>{metaLine(book)}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
      </div>
    </>
  );

  return (
    <div ref={wrapRef} className="group relative">
      {openable && !editing ? (
        <Link href={`/read/${book._id}`} className="block rounded-lg">
          {body}
        </Link>
      ) : (
        <div>{body}</div>
      )}
      <button
        aria-label={`More options for ${book.title}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-card/95 text-lg leading-none text-ink shadow-sm transition-opacity focus-visible:opacity-100 ${
          menu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        ⋯
      </button>
      {menu && (
        <div role="menu" className="absolute right-2 top-11 z-20 min-w-[170px] rounded-xl border border-line bg-card p-1 shadow-lg">
          <button
            role="menuitem"
            autoFocus
            onClick={() => {
              setMenu(false);
              setDraft(book.title);
              setEditing(true);
            }}
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-panel"
          >
            Rename
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setMenu(false);
              onRemove(book);
            }}
            className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-accent-dark hover:bg-panel"
          >
            Remove from library
          </button>
        </div>
      )}
    </div>
  );
}
