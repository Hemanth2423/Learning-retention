"use client";

import { XpStats } from "@/components/XpStats";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BookCover } from "@/components/library/BookCover";
import { BookTile, FolderOption, LibraryBook, progressOf } from "@/components/library/BookTile";
import { FolderRail, FolderView } from "@/components/library/FolderRail";
import { errorMessage } from "@/components/FieldError";
import { folderCounts, inFolder } from "@/convex/folderRules";
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
const NO_FOLDERS: FolderOption[] = [];
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
function AddCard({ onOpen, into }: { onOpen: (files?: File[]) => void; into?: string }) {
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
      // The page's primary action: the one solid terracotta surface on Home.
      className={`flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2.5 rounded-[18px] border-2 border-ink p-5 text-center text-white shadow-[0_5px_0_var(--ink)] transition active:translate-y-[3px] active:shadow-[0_2px_0_var(--ink)] ${
        dragging ? "bg-accent-dark ring-4 ring-ochre" : "bg-accent hover:bg-accent-dark"
      }`}
    >
      <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-white text-h1 leading-none text-accent-dark">
        +
      </span>
      <b className="font-serif text-h2">Add to your library</b>
      <span className="text-meta text-white/90">{FILE_KINDS.join(" · ")}</span>
      <span className="text-meta text-white/90">or paste article, YouTube and playlist links</span>
      {into && (
        <span className="mt-0.5 max-w-full truncate rounded-full bg-white/15 px-2.5 py-0.5 text-meta">
          Goes into <b>{into}</b>
        </span>
      )}
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
  const isBook = book.sourceType === "pdf" || book.sourceType === "epub";
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-6 rounded-[18px] border border-line bg-card p-5 md:grid-cols-[130px_minmax(0,1fr)]">
      <BookCover
        id={book._id}
        title={book.title}
        meta={book.sourceType === "pdf" ? `${book.pageCount} pages` : book.sourceType === "epub" ? "EPUB" : undefined}
        coverUrl={book.coverUrl}
        imageUrl={book.imageUrl}
        kind={book.sourceType}
        label={book.sourceType === "article" || book.sourceType === "video" ? (book.siteName ?? undefined) : undefined}
        pad="sm"
        className="w-[110px] text-meta md:w-[130px]"
      />
      <div className="min-w-0">
        <p className="text-meta font-semibold text-accent">{book.lastReadAt ? `Last read ${timeAgo(book.lastReadAt, now)}` : book.page ? "Pick up where you left off" : "Ready to start"}</p>
        <h3 className="mt-1 font-serif text-h2 font-bold leading-tight">{book.title}</h3>
        <p className="mt-1 text-muted">
          {!isBook
            ? book.sourceType === "video" || book.sourceType === "article"
              ? `${book.sourceType === "video" ? "Video" : "Article"} · ${book.siteName ?? ""}`
              : book.sourceType === "word"
                ? "Word document"
                : `PowerPoint · ${book.pageCount} slides`
            : book.sourceType === "epub"
              ? book.chapterTitle
                ? chapterLabel(book).replace(/ · $/, "")
                : "EPUB"
              : book.page
                ? `${chapterLabel(book)}page ${book.page}`
                : `${book.pageCount} pages`}
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
  const [adding, setAdding] = useState<{ files?: File[]; folder?: Id<"folders"> | null } | null>(null);
  const folders = (useQuery(api.folders.list) as FolderOption[] | undefined) ?? NO_FOLDERS;
  const createFolder = useMutation(api.folders.create);
  const renameFolder = useMutation(api.folders.rename);
  const removeFolder = useMutation(api.folders.remove);
  const moveItems = useMutation(api.folders.moveItems);
  const [view, setView] = useState<FolderView>("all");
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const setNotice = useCallback((message: string | null) => setToast(message ? { message } : null), []);
  const openFolder = folders.find((f) => f._id === view);
  // A folder that was deleted (here or in another tab) falls back to All items.
  const current: FolderView = view === "all" || view === "none" || openFolder ? view : "all";
  const queue = useAddQueue();
  useCoverBackfill(books);
  const closeSheet = useCallback(() => setAdding(null), []);
  const [removing, setRemoving] = useState<LibraryBook | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Move items, remembering where each came from so Undo puts them back.
  const move = useCallback(
    async (ids: Id<"documents">[], folderId: Id<"folders"> | null) => {
      const before = new Map(ids.map((id) => [id, books?.find((b) => b._id === id)?.folderId ?? null]));
      const changing = ids.filter((id) => before.get(id) !== folderId);
      if (!changing.length) return;
      try {
        await moveItems({ documentIds: changing, folderId });
      } catch (err) {
        return setNotice(errorMessage(err));
      }
      const name = folderId ? folders.find((f) => f._id === folderId)?.name : "No folder";
      setToast({
        message: `${changing.length === 1 ? `Moved “${books?.find((b) => b._id === changing[0])?.title ?? "item"}”` : `Moved ${changing.length} items`} to ${name}`,
        undo: () => {
          const groups = new Map<Id<"folders"> | null, Id<"documents">[]>();
          for (const id of changing) groups.set(before.get(id) ?? null, [...(groups.get(before.get(id) ?? null) ?? []), id]);
          for (const [f, list] of groups) void moveItems({ documentIds: list, folderId: f }).catch(() => {});
          setToast(null);
        },
      });
    },
    [books, folders, moveItems, setNotice]
  );

  async function newFolder(name: string): Promise<string | null> {
    try {
      const id = await createFolder({ name });
      setView(id);
      setToast({ message: `Made “${name.trim()}”. Drag items onto it, or add files straight into it.` });
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  }

  async function deleteFolder(f: FolderOption) {
    setFolderMenu(false);
    try {
      const { moved } = await removeFolder({ folderId: f._id });
      setView("all");
      setToast({
        message: `Deleted “${f.name}”. Its ${moved.length} item${moved.length === 1 ? "" : "s"} ${moved.length === 1 ? "is" : "are"} in No folder.`,
        undo: async () => {
          setToast(null);
          try {
            const id = await createFolder({ name: f.name, emoji: f.emoji });
            if (moved.length) await moveItems({ documentIds: moved, folderId: id });
            setView(id);
          } catch (err) {
            setNotice(errorMessage(err));
          }
        },
      });
    } catch (err) {
      setNotice(errorMessage(err));
    }
  }

  async function saveRename(f: FolderOption, name: string) {
    setRenaming(null);
    if (!name.trim() || name.trim() === f.name) return;
    await renameFolder({ folderId: f._id, name }).catch((err) => setNotice(errorMessage(err)));
  }

  const latest = books?.find((b) => b.status === "ready" && b.page) ?? books?.find((b) => b.status === "ready");
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const scope = q ? (books ?? []) : inFolder(books ?? [], current);
    const list = scope.filter((b) => (filter === "all" || groupOf(b) === filter) && (!q || b.title.toLowerCase().includes(q)));
    if (sort === "title") return [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "progress") return [...list].sort((a, b) => progressOf(b) - progressOf(a));
    return list; // the server already sorts by most recently read
  }, [books, search, sort, filter, current]);
  const fCounts = useMemo(() => folderCounts(books ?? []), [books]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, book: 0, article: 0, video: 0 };
    const q = search.trim().toLowerCase();
    for (const b of q ? (books ?? []).filter((x) => x.title.toLowerCase().includes(q)) : inFolder(books ?? [], current)) {
      c.all++;
      c[groupOf(b)]++;
    }
    return c;
  }, [books, current, search]);
  const searching = !!search.trim();
  const viewTitle = searching ? `Results for “${search.trim()}”` : current === "all" ? "Your library" : current === "none" ? "No folder" : `${openFolder!.emoji} ${openFolder!.name}`;

  return (
    <div className="flex-1">
      <header className="sticky top-0 z-10 flex items-center gap-4 bg-paper/90 px-4 py-3.5 backdrop-blur md:px-8">
        <span className="font-serif text-h2 font-bold">
          Ingrain<span className="text-accent">.</span>
        </span>
        <label className="flex max-w-sm flex-1 items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-muted">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
          <input
            value={search}
            onChange={(e) => {
              // A new search looks across every folder and every kind.
              if (!search.trim() && e.target.value.trim()) setFilter("all");
              setSearch(e.target.value);
            }}
            placeholder="Search your library" aria-label="Search your library" className="flex-1 bg-transparent text-ink outline-none" />
        </label>
        <div className="ml-auto">
          <XpStats />
        </div>
        <button onClick={() => void signOut().then(() => router.replace("/"))} className="quiet">
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-[1120px] px-4 pb-20 md:px-8">
        <h2 className="mb-4 mt-8 font-serif text-h2 font-bold">{books === undefined ? " " : latest ? "Continue reading" : "Start your library"}</h2>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
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
          <AddCard onOpen={(files) => setAdding({ files, folder: openFolder?._id ?? null })} into={openFolder ? `${openFolder.emoji} ${openFolder.name}` : undefined} />
        </div>

        {!!books?.length && (
          // Layout C (prototype 008): the primary actions above stay full width; folders sit beside the shelf.
          // Phones: heading, then the folder chips, then the shelf. Wide screens: the rail spans heading and shelf.
          <div className="mt-8 grid gap-x-6 gap-y-3 md:grid-cols-[240px_minmax(0,1fr)] md:grid-rows-[auto_1fr]">
            <div className="max-md:order-2 md:col-start-1 md:row-span-2 md:row-start-1">
            <FolderRail
              folders={folders}
              counts={fCounts}
              view={current}
              dragging={dragging}
              onView={(v) => {
                setView(v);
                setSearch("");
                setFilter("all");
              }}
              onCreate={newFolder}
              onDropItems={(ids, folderId) => {
                setDragging(false);
                void move(ids, folderId);
              }}
              onDropFiles={(files, folderId) => {
                if (folderId) setView(folderId);
                setAdding({ files, folder: folderId });
              }}
            />
            </div>
            <section aria-label={viewTitle} className="contents">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5 max-md:order-1 md:col-start-2 md:row-start-1">
              {renaming !== null && openFolder ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveRename(openFolder, renaming);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    autoFocus
                    value={renaming}
                    maxLength={40}
                    onChange={(e) => setRenaming(e.target.value)}
                    onBlur={() => void saveRename(openFolder, renaming)}
                    onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                    aria-label="Folder name"
                    className="input py-1 font-serif text-h3 font-bold"
                  />
                </form>
              ) : (
                <h2 className="mr-1.5 min-w-0 truncate font-serif text-h2 font-bold">{viewTitle}</h2>
              )}
              {openFolder && !searching && renaming === null && (
                <div className="relative">
                  <button className="icon-btn" aria-label={`Options for ${openFolder.name}`} aria-haspopup="menu" aria-expanded={folderMenu} onClick={() => setFolderMenu((m) => !m)}>
                    ⋯
                  </button>
                  {folderMenu && (
                    <div role="menu" className="absolute left-0 top-9 z-30 min-w-[230px] rounded-xl border border-line bg-card p-1 shadow-lg" onMouseLeave={() => setFolderMenu(false)}>
                      <button
                        role="menuitem"
                        autoFocus
                        className="w-full rounded-lg px-2.5 py-2 text-left text-ui hover:bg-panel"
                        onClick={() => {
                          setFolderMenu(false);
                          setRenaming(openFolder.name);
                        }}
                      >
                        ✏️ Rename folder
                      </button>
                      <button role="menuitem" className="w-full rounded-lg px-2.5 py-2 text-left text-ui text-accent-dark hover:bg-panel" onClick={() => void deleteFolder(openFolder)}>
                        🗑 Delete folder (keeps its items)
                      </button>
                    </div>
                  )}
                </div>
              )}
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
            <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] content-start gap-x-5 gap-y-[26px] max-md:order-3 md:col-start-2 md:row-start-2 md:mt-1">
              {shown.map((b) => (
                <BookTile
                  key={b._id}
                  book={b}
                  onRemove={setRemoving}
                  onError={setNotice}
                  folders={folders}
                  showFolder={current === "all" || searching}
                  onMove={(ids, folderId) => void move(ids, folderId)}
                  onDragChange={setDragging}
                />
              ))}
              {shown.length === 0 && (
                <p className="empty-note col-span-full">
                  {searching
                    ? `Nothing matches “${search.trim()}”. Try a shorter word, or clear the search.`
                    : openFolder && filter === "all"
                      ? "This folder is empty. Drag items here from All items, or use Add to your library above: new items go straight into this folder."
                      : current === "none" && filter === "all"
                        ? "Everything is in a folder."
                        : "Nothing of this kind here. Choose All to see everything in this view."}
                </p>
              )}
            </div>
            </section>
          </div>
        )}
      </main>

      {adding && (
        <AddSheet
          initialFiles={adding.files}
          folders={folders}
          initialFolder={adding.folder ?? null}
          onClose={closeSheet}
          onAdd={(files, links, folderId) => {
            setAdding(null);
            if (files.length) queue.addFiles(files, folderId ?? undefined);
            if (links.length) queue.addLinks(links, folderId ?? undefined);
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
      {toast && (
        <p role="status" className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-lg bg-ink px-4 py-2 text-ui text-white shadow-lg">
          <span className="min-w-0 truncate">{toast.message}</span>
          {toast.undo && (
            <button className="shrink-0 font-bold text-ochre hover:underline" onClick={toast.undo}>
              Undo
            </button>
          )}
          <button className="shrink-0 text-white/70 hover:text-white" aria-label="Dismiss" onClick={() => setToast(null)}>
            ✕
          </button>
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
