"use client";

import Link from "next/link";
import { LibraryBook, openHref } from "@/components/library/BookTile";
import { QueueItem } from "./useAddQueue";

// A file's state comes from the library once the server has it (preparing → ready or failed).
export function resolveItem(item: QueueItem, books: LibraryBook[] | undefined): QueueItem & { book?: LibraryBook } {
  const book = item.documentId ? books?.find((b) => b._id === item.documentId) : undefined;
  if (item.kind !== "file" || item.state !== "preparing" || !book) return { ...item, book };
  if (book.status === "ready") return { ...item, book, state: "ready" };
  if (book.status === "failed")
    return {
      ...item,
      book,
      state: "failed",
      message: book.statusMessage ?? "We couldn't read this file.",
    };
  return { ...item, book };
}

const STATUS: Record<QueueItem["state"], string> = {
  waiting: "Waiting",
  reading: "Reading the file…",
  uploading: "Uploading",
  adding: "Reading the page…",
  preparing: "Preparing…",
  ready: "Ready",
  failed: "Couldn't add",
};

// The corner queue: one line per item being added, with its state. A failed item says why.
export function UploadQueue({ items, books, onClose }: { items: QueueItem[]; books: LibraryBook[] | undefined; onClose: () => void }) {
  if (!items.length) return null;
  const rows = items.map((i) => resolveItem(i, books));
  const ready = rows.filter((r) => r.state === "ready").length;
  const failed = rows.filter((r) => r.state === "failed").length;
  const busy = rows.length - ready - failed;
  const title = busy ? `Adding ${rows.length} · ${ready} ready` : failed ? `${ready} added · ${failed} couldn't be added` : `${ready} added to your library`;

  return (
    <aside
      aria-label="Adding to your library"
      className="fixed bottom-[22px] right-[22px] z-40 w-[340px] max-w-[calc(100vw-44px)] rounded-[14px] border-2 border-ink bg-card shadow-[0_5px_0_var(--ink)]"
    >
      <header className="flex items-center justify-between border-b border-line py-2 pl-3.5 pr-2.5 font-semibold" aria-live="polite">
        <span>{title}</span>
        {!busy && (
          <button onClick={onClose} aria-label="Close" className="icon-btn h-7 w-7">
            ✕
          </button>
        )}
      </header>
      <ul className="max-h-[300px] overflow-y-auto py-1.5">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2 px-3.5 py-1.5 text-meta">
            <span aria-hidden="true" className="grid place-items-center">
              {r.state === "ready" ? "✅" : r.state === "failed" ? "⚠️" : r.state === "waiting" ? "·" : <span className="spin" />}
            </span>
            {r.state === "ready" && r.book ? (
              <Link href={openHref(r.book)} className="truncate font-semibold hover:text-accent" title={r.book.title}>
                {r.book.title}
              </Link>
            ) : (
              <span className="truncate" title={r.name}>
                {r.book?.title ?? r.name}
              </span>
            )}
            <span className={`text-label ${r.state === "failed" ? "text-accent-dark" : "text-muted"}`}>
              {r.state === "uploading" ? (
                `${r.pct ?? 0}%`
              ) : r.state === "ready" && r.book ? (
                <Link href={openHref(r.book)} className="font-semibold text-accent">
                  Open
                </Link>
              ) : (
                STATUS[r.state]
              )}
            </span>
            {r.message && (
              <span className={`col-start-2 col-end-4 text-label ${r.state === "failed" ? "text-accent-dark" : "text-muted"}`}>
                {r.message}
                {r.state === "failed" && r.book && (
                  <>
                    {" "}
                    <Link href={openHref(r.book)} className="font-semibold underline">
                      Open it
                    </Link>
                  </>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
