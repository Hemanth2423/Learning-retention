"use client";

import { XpStats } from "@/components/XpStats";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BookCover } from "@/components/library/BookCover";
import { BookTile, LibraryBook, progressOf } from "@/components/library/BookTile";
import { timeAgo } from "@/components/library/time";
import { ReadingShell } from "@/components/ReadingShell";
import { renderPdfCover, uploadImage } from "@/components/library/covers";
import { AddSheet } from "@/components/upload/AddSheet";
import { FILE_KINDS } from "@/components/upload/sources";
import { UploadQueue } from "@/components/upload/UploadQueue";
import { useAddQueue } from "@/components/upload/useAddQueue";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Sort = "recent" | "title" | "progress";
type Filter = "all" | "book" | "article" | "video";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "book", label: "📚 Books" },
  { key: "article", label: "📰 Articles" },
  { key: "video", label: "▶ Videos" },
];
const groupOf = (b: LibraryBook): Filter => (b.sourceType === "article" ? "article" : b.sourceType === "video" ? "video" : "book");

// Books added before covers existed get one the first time the library opens: page 1 is drawn in the browser,
// one book at a time. Each book is tried once per visit; a first page that isn't a cover (mostly white) is
// remembered on the server so it isn't drawn again.
function useCoverBackfill(books: LibraryBook[] | undefined) {
  const convex = useConvex();
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const setCover = useMutation(api.documents.setCover);
  const skipCover = useMutation(api.documents.skipCover);
  const tried = useRef(new Set<string>());
  const busy = useRef(false);
  useEffect(() => {
    const next = books?.find((b) => b.needsCover && !tried.current.has(b._id));
    if (!next || busy.current) return;
    busy.current = true;
    tried.current.add(next._id);
    (async () => {
      const url = await convex.query(api.documents.fileUrl, { documentId: next._id });
      if (!url) return;
      const image = await renderPdfCover({ url });
      if (!image) return void (await skipCover({ documentId: next._id }));
      const coverId = await uploadImage(await generateUploadUrl(), image);
      await setCover({ documentId: next._id, coverId: coverId as Id<"_storage"> });
    })()
      .catch((err) => console.warn("[covers] couldn't draw a cover", err))
      .finally(() => {
        busy.current = false;
      });
  }, [books, convex, generateUploadUrl, setCover, skipCover]);
}

// The "+" card: opens the Add sheet. Files dropped straight onto it open the sheet with them listed.
function AddCard({ onOpen }: { onOpen: (files?: File[]) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpen()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onOpen(Array.from(e.dataTransfer.files));
      }}
      className={`flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed p-[18px] text-center transition ${
        dragging ? "border-accent bg-card" : "border-[#b9a88f] bg-card/55 hover:border-accent hover:bg-card"
      }`}
    >
      <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-accent text-h1 leading-none text-white">
        +
      </span>
      <b className="font-serif text-h3">Add to your library</b>
      <span className="flex flex-wrap justify-center gap-1">
        {FILE_KINDS.map((k) => (
          <span key={k} className="kind">
            {k}
          </span>
        ))}
      </span>
      <span className="text-meta text-muted">or paste article and YouTube links</span>
    </button>
  );
}

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
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-6 rounded-[18px] border border-line bg-card p-5 md:grid-cols-[130px_minmax(0,1fr)]">
      <BookCover
        id={book._id}
        title={book.title}
        meta={isBook ? `${book.pageCount} pages` : undefined}
        coverUrl={book.coverUrl}
        imageUrl={book.imageUrl}
        kind={book.sourceType}
        label={isBook ? undefined : (book.siteName ?? undefined)}
        pad="sm"
        className="w-[110px] text-meta md:w-[130px]"
      />
      <div className="min-w-0">
        <p className="text-meta font-semibold text-accent">{book.lastReadAt ? `Last read ${timeAgo(book.lastReadAt, now)}` : book.page ? "Pick up where you left off" : "Ready to start"}</p>
        <h3 className="mt-1 font-serif text-h2 font-bold leading-tight">{book.title}</h3>
        <p className="mt-1 text-muted">
          {!isBook ? `${book.sourceType === "video" ? "Video" : "Article"} · ${book.siteName ?? ""}` : book.page ? `${chapterLabel(book)}page ${book.page}` : `${book.pageCount} pages`}
        </p>
        {isBook && (
          <div className="mt-3 flex max-w-md items-center gap-3 text-meta text-muted">
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
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState<{ files?: File[] } | null>(null);
  const queue = useAddQueue();
  useCoverBackfill(books);
  const closeSheet = useCallback(() => setAdding(null), []);
  const [removing, setRemoving] = useState<LibraryBook | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const latest = books?.find((b) => b.status === "ready" && b.page) ?? books?.find((b) => b.status === "ready");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (books ?? []).filter((b) => (filter === "all" || groupOf(b) === filter) && (!q || b.title.toLowerCase().includes(q)));
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "progress") return [...list].sort((a, b) => progressOf(b) - progressOf(a));
    return list; // the server already sorts by most recently read
  }, [books, search, sort, filter]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, book: 0, article: 0, video: 0 };
    for (const b of books ?? []) {
      c.all++;
      c[groupOf(b)]++;
    }
    return c;
  }, [books]);

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 flex items-center gap-4 bg-paper/90 px-4 py-3.5 backdrop-blur md:px-8">
        <span className="font-serif text-h2 font-bold">
          Ingrain<span className="text-accent">.</span>
        </span>
        <label className="flex max-w-sm flex-1 items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-muted">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your library" aria-label="Search your library" className="flex-1 bg-transparent text-ink outline-none" />
        </label>
        <div className="ml-auto">
          <XpStats />
        </div>
        <button onClick={() => void signOut().then(() => router.replace("/"))} className="quiet">
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-20 md:px-8">
        <h2 className="mb-3.5 mt-6 font-serif text-h2 font-bold">{books === undefined ? " " : latest ? "Continue reading" : "Start your library"}</h2>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
          {books === undefined ? (
            <div className="h-[230px] animate-pulse rounded-[18px] bg-card/60" />
          ) : latest ? (
            <ResumeCard book={latest} />
          ) : (
            <div className="flex flex-col justify-center rounded-[18px] border border-line bg-card p-6">
              <p className="font-serif text-h2 font-bold">Your library is empty</p>
              <p className="mt-2 max-w-md text-muted">Add a book you want to learn from, or an article or talk. A book&apos;s chapters become stops on your path, with notes and quick tests along the way.</p>
              <button className="chunky mt-4 self-start" onClick={() => setAdding({})}>
                + Add to your library
              </button>
            </div>
          )}
          <AddCard onOpen={(files) => setAdding({ files })} />
        </div>

        {!!books?.length && (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <h2 className="mr-1.5 font-serif text-h2 font-bold">Your library</h2>
              <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
                {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => (
                  <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                    {f.label} <span className="opacity-70">{counts[f.key]}</span>
                  </button>
                ))}
              </div>
              <div role="group" aria-label="Sort" className="seg ml-auto">
                {(["recent", "title", "progress"] as const).map((s) => (
                  <button
                    key={s}
                    aria-pressed={sort === s}
                    onClick={() => setSort(s)}
                    className="px-3 py-1 capitalize"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-5 gap-y-[26px]">
              {shown.map((b) => (
                <BookTile key={b._id} book={b} onRemove={setRemoving} onError={setNotice} />
              ))}
              {shown.length === 0 && (
                <p className="empty-note col-span-full">
                  {search.trim() ? `Nothing matches “${search.trim()}”. Try a shorter word, or clear the search.` : "Nothing here yet. Choose All to see everything in your library."}
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {adding && (
        <AddSheet
          initialFiles={adding.files}
          onClose={closeSheet}
          onAdd={(files, links) => {
            setAdding(null);
            if (files.length) queue.addFiles(files);
            if (links.length) queue.addLinks(links);
          }}
        />
      )}
      <UploadQueue items={queue.items} books={books} onClose={queue.clearFinished} />
      <ConfirmDialog
        open={!!removing}
        title={`Remove this ${removing?.sourceType === "article" ? "article" : removing?.sourceType === "video" ? "video" : "book"}?`}
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
        <p role="alert" onClick={() => setNotice(null)} className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-ink px-4 py-2 text-ui text-white shadow-lg">
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
