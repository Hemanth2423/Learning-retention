"use client";

import { TopNav } from "@/components/TopNav";
import { useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BookCover } from "@/components/library/BookCover";
import { BookTile, FolderOption, ITEM_DRAG_TYPE, LibraryBook, progressOf } from "@/components/library/BookTile";
import { FolderSheet, FolderSheetMode } from "@/components/library/FolderSheet";
import { FolderRail, FolderView } from "@/components/library/FolderRail";
import { errorMessage } from "@/components/FieldError";
import { canHaveSubfolder, childrenOf, flattenFolders, folderCounts, folderPath, inFolder, moveFolderProblem, totalInFolder } from "@/convex/folderRules";
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
      className={`flex h-full min-h-[200px] w-full min-w-0 flex-col items-center justify-center gap-2.5 rounded-[18px] border-2 border-dashed p-5 text-center transition ${
        dragging ? "border-accent bg-card" : "border-[#b9a88f] bg-card/55 hover:border-accent hover:bg-card"
      }`}
    >
      <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-accent text-h1 leading-none text-white">
        +
      </span>
      <b className="font-serif text-h2">Add to your library</b>
      <span className="text-meta text-muted">{FILE_KINDS.join(" · ")}</span>
      <span className="text-meta text-muted">or paste article, YouTube and playlist links</span>
      {into && (
        <span className="mt-0.5 block max-w-full truncate rounded-full bg-accent-soft px-2.5 py-0.5 text-meta text-accent-dark">
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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState<{ files?: File[]; folder?: Id<"folders"> | null } | null>(null);
  const folders = (useQuery(api.folders.list) as FolderOption[] | undefined) ?? NO_FOLDERS;
  const createFolder = useMutation(api.folders.create);
  const renameFolder = useMutation(api.folders.rename);
  const removeFolder = useMutation(api.folders.remove);
  const moveItems = useMutation(api.folders.moveItems);
  const moveFolder = useMutation(api.folders.moveFolder);
  const restoreFolder = useMutation(api.folders.restore);
  const [sheet, setSheet] = useState<FolderSheetMode | null>(null);
  const closeFolderSheet = useCallback(() => setSheet(null), []);
  const folderMenuRef = useRef<HTMLDivElement>(null);
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

  // The folder menu closes on a click outside it or Esc.
  useEffect(() => {
    if (!folderMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !folderMenuRef.current?.contains(e.target as Node)) setFolderMenu(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [folderMenu]);

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

  async function newFolder(name: string, parentId: Id<"folders"> | null, ids: Id<"documents">[]) {
    const id = await createFolder({ name, parentId: parentId ?? undefined, documentIds: ids.length ? ids : undefined });
    setView(id);
    setSearch("");
    setFilter("all");
    setToast({ message: ids.length ? `Made “${name.trim()}” with ${ids.length} item${ids.length === 1 ? "" : "s"}` : `Made “${name.trim()}”` });
  }

  async function deleteFolder(f: FolderOption) {
    setFolderMenu(false);
    try {
      const res = await removeFolder({ folderId: f._id });
      setView(res.parentId ?? "all");
      const where = res.parentId ? folders.find((x) => x._id === res.parentId)?.name : "No folder";
      const kept = res.moved.length + res.children.length;
      setToast({
        message: kept ? `Deleted “${f.name}”. What was inside moved to ${res.children.length && !res.parentId ? "the top level" : where}.` : `Deleted “${f.name}”`,
        undo: async () => {
          setToast(null);
          try {
            setView(await restoreFolder({ name: f.name, emoji: f.emoji, parentId: res.parentId, documentIds: res.moved, children: res.children }));
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

  async function nestFolder(id: Id<"folders">, parentId: Id<"folders"> | null) {
    setFolderMenu(false);
    const f = folders.find((x) => x._id === id);
    if (!f || f.parentId === parentId) return;
    const before = f.parentId;
    try {
      await moveFolder({ folderId: id, parentId });
      setToast({
        message: `Moved “${f.name}” to ${parentId ? folders.find((x) => x._id === parentId)?.name : "the top level"}`,
        undo: () => {
          setToast(null);
          void moveFolder({ folderId: id, parentId: before }).catch((err) => setNotice(errorMessage(err)));
        },
      });
    } catch (err) {
      setNotice(errorMessage(err));
    }
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
  const path = openFolder ? folderPath(folders, openFolder._id) : [];
  const subfolders = openFolder ? childrenOf(folders, openFolder._id) : [];
  const viewTitle = searching ? `Results for “${search.trim()}”` : current === "all" ? "Your library" : current === "none" ? "No folder" : `${openFolder!.emoji} ${openFolder!.name}`;

  return (
    <div className="flex-1">
      <TopNav>
        <label className="flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-2 text-muted w-full md:max-w-xs">
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
            placeholder="Search your library" aria-label="Search your library" className="min-w-0 flex-1 bg-transparent text-ink outline-none" />
        </label>
      </TopNav>

      <main className="mx-auto max-w-[1120px] px-4 pb-20 md:px-8">
        <h2 className="mb-4 mt-8 font-serif text-h2 font-bold">{books === undefined ? " " : latest ? "Continue reading" : "Start your library"}</h2>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
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
          // Phones: heading, then the folder chips, then the shelf. Wide screens: the rail spans heading and shelf.
          <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 md:grid-cols-[250px_minmax(0,1fr)] md:grid-rows-[auto_1fr]">
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
                  setRenaming(null);
                }}
                onNew={() => setSheet({ kind: "create", parentId: null })}
                onDropItems={(ids, folderId) => {
                  setDragging(false);
                  void move(ids, folderId);
                }}
                onDropFiles={(files, folderId) => {
                  if (folderId) setView(folderId);
                  setAdding({ files, folder: folderId });
                }}
                onMoveFolder={(id, parentId) => void nestFolder(id, parentId)}
              />
            </div>
            <section aria-label={viewTitle} className="contents">
              <div className="min-w-0 max-md:order-1 md:col-start-2 md:row-start-1">
                {openFolder && !searching && (
                  <nav aria-label="Folder path" className="mb-1 flex min-w-0 items-center gap-1 text-meta text-muted">
                    <button className="shrink-0 hover:text-ink hover:underline" onClick={() => setView("all")}>
                      Library
                    </button>
                    {path.slice(0, -1).map((p) => (
                      <span key={p._id} className="flex min-w-0 items-center gap-1">
                        <span aria-hidden="true">›</span>
                        <button className="max-w-[140px] truncate hover:text-ink hover:underline" onClick={() => setView(p._id)}>
                          {p.name}
                        </button>
                      </span>
                    ))}
                  </nav>
                )}
                <div className="flex min-w-0 items-center gap-2 max-md:flex-wrap">
                  {renaming !== null && openFolder ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveRename(openFolder, renaming);
                      }}
                      className="min-w-0 max-w-[340px] flex-1"
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
                    <h2 className="min-w-0 max-w-[calc(100%-44px)] truncate font-serif text-h2 font-bold md:max-w-none" title={viewTitle}>
                      {viewTitle}
                    </h2>
                  )}
                  {openFolder && !searching && renaming === null && (
                    <div className="relative shrink-0" ref={folderMenuRef}>
                      <button className="icon-btn" aria-label={`Options for ${openFolder.name}`} aria-haspopup="menu" aria-expanded={folderMenu} onClick={() => setFolderMenu((m) => !m)}>
                        ⋯
                      </button>
                      {folderMenu && (
                        <div role="menu" className="absolute left-0 top-9 z-30 max-h-[60vh] min-w-[240px] overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-lg">
                          <button
                            role="menuitem"
                            autoFocus
                            className="w-full rounded-lg px-2.5 py-2 text-left text-ui hover:bg-panel"
                            onClick={() => {
                              setFolderMenu(false);
                              setRenaming(openFolder.name);
                            }}
                          >
                            ✏️ Rename
                          </button>
                          {canHaveSubfolder(folders, openFolder._id) && (
                            <button
                              role="menuitem"
                              className="w-full rounded-lg px-2.5 py-2 text-left text-ui hover:bg-panel"
                              onClick={() => {
                                setFolderMenu(false);
                                setSheet({ kind: "create", parentId: openFolder._id });
                              }}
                            >
                              📁 New folder inside
                            </button>
                          )}
                          <div className="my-1 border-t border-line" />
                          <p className="px-2.5 pb-1 pt-1 text-label font-bold uppercase tracking-[0.08em] text-muted">Move to</p>
                          {openFolder.parentId && (
                            <button role="menuitem" className="w-full rounded-lg px-2.5 py-1.5 text-left text-meta hover:bg-panel" onClick={() => void nestFolder(openFolder._id, null)}>
                              Library (top level)
                            </button>
                          )}
                          {flattenFolders(folders)
                            .filter((f) => f._id !== openFolder.parentId && !moveFolderProblem(folders, openFolder._id, f._id))
                            .map((f) => (
                              <button
                                key={f._id}
                                role="menuitem"
                                style={{ paddingLeft: 10 + f.depth * 12 }}
                                className="block w-full truncate rounded-lg py-1.5 pr-2.5 text-left text-meta hover:bg-panel"
                                onClick={() => void nestFolder(openFolder._id, f._id)}
                              >
                                {f.emoji} {f.name}
                              </button>
                            ))}
                          <div className="my-1 border-t border-line" />
                          <button role="menuitem" className="w-full rounded-lg px-2.5 py-2 text-left text-ui text-accent-dark hover:bg-panel" onClick={() => void deleteFolder(openFolder)}>
                            🗑 Delete folder (keeps what&apos;s inside)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-2 md:ml-auto">
                    <span id="sort-label" className="text-meta font-semibold text-muted">
                      Sort by
                    </span>
                    <div role="group" aria-labelledby="sort-label" className="seg">
                      {(["recent", "title", "progress"] as const).map((s) => (
                        <button key={s} aria-pressed={sort === s} onClick={() => setSort(s)} className="px-3 py-1 capitalize">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {counts.all > 0 && (
                    <span id="filter-label" className="text-meta font-semibold text-muted">
                      Filter by
                    </span>
                  )}
                  {counts.all > 0 && (
                    <div role="group" aria-labelledby="filter-label" className="flex flex-wrap gap-1.5">
                      {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => (
                        <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                          {f.label} <span className="opacity-70">{counts[f.key]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {openFolder && !searching && counts.all + subfolders.length > 0 && (
                    <button className="chunky sm ml-auto" onClick={() => setSheet({ kind: "add", folderId: openFolder._id })}>
                      + Add items
                    </button>
                  )}
                </div>
              </div>
              <div className="min-w-0 max-md:order-3 md:col-start-2 md:row-start-2">
                {!searching && subfolders.length > 0 && (
                  <ul aria-label="Folders inside" className="mb-5 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
                    {subfolders.map((f) => (
                      <li key={f._id}>
                        <button
                          onClick={() => setView(f._id)}
                          onDragOver={(e) => {
                            if (e.dataTransfer.types.includes(ITEM_DRAG_TYPE)) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData(ITEM_DRAG_TYPE);
                            setDragging(false);
                            if (raw) void move(JSON.parse(raw) as Id<"documents">[], f._id);
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-left transition hover:border-accent ${dragging ? "border-dashed border-accent" : "border-line"}`}
                        >
                          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: f.colour }}>
                            {f.emoji}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{f.name}</span>
                            <span className="block text-label text-muted">{totalInFolder(folders, fCounts.byFolder, f._id)} items</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {openFolder && !searching && counts.all === 0 && subfolders.length === 0 ? (
                  <div className="rounded-[18px] border border-line bg-card px-6 py-12 text-center">
                    <p className="font-serif text-h2 font-bold">Let&apos;s fill this folder</p>
                    <p className="mx-auto mt-1.5 max-w-sm text-muted">Pick from what&apos;s already in your library, or add something new.</p>
                    <div className="mt-5 flex flex-wrap justify-center gap-3">
                      <button className="chunky" onClick={() => setSheet({ kind: "add", folderId: openFolder._id })}>
                        + Add from library
                      </button>
                      <button className="chunky chunky-light" onClick={() => setAdding({ folder: openFolder._id })}>
                        Upload new
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] content-start gap-x-5 gap-y-7">
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
                        onNewFolder={(book) => setSheet({ kind: "create", parentId: null, preselect: [book._id] })}
                      />
                    ))}
                    {shown.length === 0 && !(openFolder && subfolders.length > 0 && !searching) && (
                      <p className="empty-note col-span-full">
                        {searching ? `Nothing matches “${search.trim()}”. Try a shorter word, or clear the search.` : current === "none" && filter === "all" ? "Everything is in a folder." : "Nothing of this kind here. Choose All to see everything in this view."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {sheet && (
        <FolderSheet
          mode={sheet}
          books={books ?? []}
          folders={folders}
          onClose={closeFolderSheet}
          onCreate={newFolder}
          onAdd={async (folderId, ids) => {
            await move(ids, folderId);
          }}
        />
      )}
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
      <UploadQueue
        items={queue.items}
        books={books}
        onClose={queue.clearFinished}
        onOpenFolder={(id) => {
          setView(id);
          setSearch("");
          setFilter("all");
        }}
      />
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
