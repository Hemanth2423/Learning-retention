"use client";

import { XpStats } from "@/components/XpStats";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BookCover } from "@/components/library/BookCover";
import { BookTile, LibraryBook, progressOf } from "@/components/library/BookTile";
import { timeAgo } from "@/components/library/time";
import { ReadingShell } from "@/components/ReadingShell";
import { AddLinkForm } from "@/components/upload/AddLinkForm";
import { UploadCard } from "@/components/upload/UploadCard";
import { api } from "@/convex/_generated/api";

type Sort = "recent" | "title" | "progress";

// "Chapter 10 · Design a Notification System · ", without repeating "Chapter 10" when the title already says it.
function chapterLabel(b: LibraryBook): string {
  if (!b.chapterNumber || !b.chapterTitle) return "";
  return /^(chapter|ch\.?)\s*\d/i.test(b.chapterTitle) ? `${b.chapterTitle} · ` : `Chapter ${b.chapterNumber} · ${b.chapterTitle} · `;
}

function ResumeCard({ book }: { book: LibraryBook }) {
  const pct = progressOf(book);
  const [now] = useState(() => Date.now());
  const isBook = book.sourceType === "pdf";
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-6 rounded-[18px] border border-line bg-card p-6 md:grid-cols-[130px_minmax(0,1fr)]">
      <BookCover
        id={book._id}
        title={book.title}
        pageCount={isBook ? book.pageCount : undefined}
        imageUrl={book.imageUrl}
        kind={book.sourceType}
        className="h-[155px] w-[110px] text-[15px] md:h-[180px] md:w-[130px] md:text-[17px]"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-accent">{book.lastReadAt ? `Last read ${timeAgo(book.lastReadAt, now)}` : book.page ? "Pick up where you left off" : "Ready to start"}</p>
        <h3 className="mt-1 font-serif text-2xl font-bold leading-tight">{book.title}</h3>
        <p className="mt-1 text-muted">
          {!isBook ? `${book.sourceType === "video" ? "Video" : "Article"} · ${book.siteName ?? ""}` : book.page ? `${chapterLabel(book)}page ${book.page}` : `${book.pageCount} pages`}
        </p>
        {isBook && (
          <div className="mt-3 flex max-w-md items-center gap-3 text-[13px] text-muted">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
            </span>
            <span>{pct}%</span>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href={`/read/${book._id}/book`} className="chunky">
            {book.sourceType === "video" ? "▶ Watch" : `📖 ${book.page ? "Continue reading" : "Start reading"}`}
          </Link>
          {isBook && (
            <Link href={`/read/${book._id}`} className="chunky chunky-light">
              View chapter path
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Library() {
  const books = useQuery(api.documents.list) as LibraryBook[] | undefined;
  const removeBook = useMutation(api.documents.remove);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [removing, setRemoving] = useState<LibraryBook | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const latest = books?.find((b) => b.status === "ready" && b.page) ?? books?.find((b) => b.status === "ready");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (books ?? []).filter((b) => !q || b.title.toLowerCase().includes(q));
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "progress") return [...list].sort((a, b) => progressOf(b) - progressOf(a));
    return list; // the server already sorts by most recently read
  }, [books, search, sort]);

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 flex items-center gap-4 bg-paper/90 px-4 py-3.5 backdrop-blur md:px-8">
        <span className="font-serif text-[22px] font-bold">
          Ingrain<span className="text-accent">.</span>
        </span>
        <label className="flex max-w-sm flex-1 items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-muted">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your library" aria-label="Search your library" className="flex-1 bg-transparent text-ink outline-none" />
        </label>
        <div className="ml-auto">
          <XpStats />
        </div>
        <button onClick={() => void signOut().then(() => router.replace("/"))} className="text-sm text-muted hover:text-ink">
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-20 md:px-8">
        <h2 className="mb-3.5 mt-6 font-serif text-[22px] font-bold">{books === undefined ? " " : latest ? "Continue reading" : "Start your library"}</h2>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
          {books === undefined ? (
            <div className="h-[230px] animate-pulse rounded-[18px] bg-card/60" />
          ) : latest ? (
            <ResumeCard book={latest} />
          ) : (
            <div className="flex flex-col justify-center rounded-[18px] border border-line bg-card p-6">
              <p className="font-serif text-2xl font-bold">Your library is empty</p>
              <p className="mt-2 max-w-md text-muted">Add a PDF of a non-fiction book you want to learn from. Each chapter becomes a stop on your path, with notes and quick tests along the way.</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <UploadCard />
            <AddLinkForm />
          </div>
        </div>

        {!!books?.length && (
          <>
            <div className="mt-8 flex flex-wrap items-baseline gap-3.5">
              <h2 className="font-serif text-[22px] font-bold">Your library</h2>
              <span className="text-sm text-muted">
                {books.length} item{books.length === 1 ? "" : "s"}
              </span>
              <div role="group" aria-label="Sort books" className="ml-auto flex gap-1 text-[13px]">
                {(["recent", "title", "progress"] as const).map((s) => (
                  <button
                    key={s}
                    aria-pressed={sort === s}
                    onClick={() => setSort(s)}
                    className={`rounded-full px-2.5 py-1 font-medium capitalize ${sort === s ? "bg-card text-ink ring-1 ring-line" : "text-muted hover:text-ink"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-[22px] gap-y-7">
              {shown.map((b) => (
                <BookTile key={b._id} book={b} onRemove={setRemoving} onError={setNotice} />
              ))}
              {shown.length === 0 && <p className="text-muted">Nothing matches “{search}”.</p>}
            </div>
          </>
        )}
      </main>

      <ConfirmDialog
        open={!!removing}
        title="Remove this book?"
        message={removing ? `“${removing.title}” and your highlights, notes and chat for it will be deleted. This can't be undone.` : ""}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const b = removing;
          setRemoving(null);
          if (b) removeBook({ documentId: b._id }).catch(() => setNotice("We couldn't remove that book. Try again."));
        }}
      />
      {notice && (
        <p role="alert" onClick={() => setNotice(null)} className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {notice}
        </p>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <ReadingShell chrome={false}>
      <Library />
    </ReadingShell>
  );
}
