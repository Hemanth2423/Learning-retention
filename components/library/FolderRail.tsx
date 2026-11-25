"use client";

import { useMemo, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { flattenFolders, folderPath, totalInFolder } from "@/convex/folderRules";
import { FolderOption, ITEM_DRAG_TYPE } from "./BookTile";

export type FolderView = "all" | "none" | Id<"folders">;
export const FOLDER_DRAG_TYPE = "application/x-ingrain-folder";

// The folder tree beside "Your library". On wide screens a sticky card with expandable folders; on phones a row of
// chips. Folders take dropped items, files from the computer, and other folders (to nest them).
export function FolderRail({
  folders,
  counts,
  view,
  dragging,
  onView,
  onNew,
  onDropItems,
  onDropFiles,
  onMoveFolder,
}: {
  folders: FolderOption[];
  counts: { all: number; none: number; byFolder: Map<string, number> };
  view: FolderView;
  dragging: boolean; // an item is being dragged: show where it can go
  onView: (v: FolderView) => void;
  onNew: () => void;
  onDropItems: (ids: Id<"documents">[], folderId: Id<"folders"> | null) => void;
  onDropFiles: (files: File[], folderId: Id<"folders"> | null) => void;
  onMoveFolder: (id: Id<"folders">, parentId: Id<"folders"> | null) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => flattenFolders(folders), [folders]);
  const hasKids = useMemo(() => new Set(folders.flatMap((f) => (f.parentId ? [f.parentId] : []))), [folders]);
  // The open folder's parents always stay expanded.
  const onPath = useMemo(() => new Set(view === "all" || view === "none" ? [] : folderPath(folders, view).map((f) => f._id as string)), [folders, view]);
  const hidden = (f: FolderOption) => folderPath(folders, f._id).slice(0, -1).some((p) => closed.has(p._id) && !onPath.has(p._id));

  const dropProps = (id: FolderView) => ({
    onDragOver: (e: React.DragEvent) => {
      const t = e.dataTransfer.types;
      const isFolder = t.includes(FOLDER_DRAG_TYPE);
      if (id === "all" ? !isFolder : !(t.includes(ITEM_DRAG_TYPE) || t.includes("Files") || (isFolder && id !== "none"))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = t.includes("Files") ? "copy" : "move";
      setOver(id);
    },
    onDragLeave: () => setOver((o) => (o === id ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      const target = id === "none" || id === "all" ? null : (id as Id<"folders">);
      const folder = e.dataTransfer.getData(FOLDER_DRAG_TYPE);
      if (folder) {
        if (folder !== target) onMoveFolder(folder as Id<"folders">, target);
        return;
      }
      const raw = e.dataTransfer.getData(ITEM_DRAG_TYPE);
      if (raw) onDropItems(JSON.parse(raw) as Id<"documents">[], target);
      else if (e.dataTransfer.files.length) onDropFiles(Array.from(e.dataTransfer.files), target);
    },
  });

  const row = (id: FolderView, current: boolean) =>
    `flex min-w-0 flex-1 items-center gap-2.5 whitespace-nowrap rounded-[10px] border px-2 py-1.5 text-left transition ${
      over === id
        ? "border-dashed border-accent bg-accent-soft"
        : current
          ? "border-line bg-white font-semibold text-accent-dark shadow-[0_1px_2px_rgba(42,34,27,.08)]"
          : dragging && id !== "all"
            ? "border-dashed border-[#c9b9a0] bg-panel/60"
            : "border-transparent hover:bg-panel"
    } max-md:rounded-full max-md:border-line max-md:bg-card max-md:py-1`;
  const icon = (emoji: string, colour?: string) => (
    <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-meta" style={{ background: colour ?? "var(--panel)", color: colour ? "#fff" : "var(--muted)" }}>
      {emoji}
    </span>
  );

  return (
    <nav aria-label="Folders" className="md:sticky md:top-[76px] md:max-h-[calc(100dvh-100px)] md:overflow-y-auto md:rounded-2xl md:border md:border-line md:bg-card md:px-2.5 md:py-3">
      <div className="mb-2 hidden items-center justify-between px-2 md:flex">
        <p className="text-label font-bold uppercase tracking-[0.08em] text-muted">Library</p>
        <button onClick={onNew} aria-label="New folder" title="New folder" className="icon-btn h-7 w-7 border border-line bg-white text-h3 leading-none text-accent-dark hover:border-accent hover:bg-white">
          +
        </button>
      </div>
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:block md:space-y-0.5 md:overflow-visible md:px-0 md:pb-0">
        <li className="shrink-0 md:mb-2 md:border-b md:border-line md:pb-2">
          <button onClick={() => onView("all")} aria-current={view === "all" ? "true" : undefined} {...dropProps("all")} className={`${row("all", view === "all")} w-full`}>
            {icon("📚")}
            <span className="min-w-0 flex-1 truncate">All items</span>
            <span className="text-label text-muted">{counts.all}</span>
          </button>
        </li>
        {tree.map((f) => {
          const current = view === f._id;
          const open = !closed.has(f._id) || onPath.has(f._id);
          return (
            <li key={f._id} className={`shrink-0 ${hidden(f) ? "md:hidden" : ""}`}>
              <div className="flex items-center">
                <span className="hidden shrink-0 md:block" style={{ width: f.depth * 14 }} />
                {hasKids.has(f._id) ? (
                  <button
                    onClick={() =>
                      setClosed((c) => {
                        const next = new Set(c);
                        if (open) next.add(f._id);
                        else next.delete(f._id);
                        return next;
                      })
                    }
                    aria-label={`${open ? "Collapse" : "Expand"} ${f.name}`}
                    aria-expanded={open}
                    className="hidden h-6 w-4 shrink-0 place-items-center rounded text-label text-muted hover:text-ink md:grid"
                  >
                    {open ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="hidden w-4 shrink-0 md:block" />
                )}
                <button
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(FOLDER_DRAG_TYPE, f._id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onView(f._id)}
                  aria-current={current ? "true" : undefined}
                  title={f.name}
                  {...dropProps(f._id)}
                  className={row(f._id, current)}
                >
                  {icon(f.emoji, f.colour)}
                  <span className="min-w-0 flex-1 truncate max-md:max-w-[140px]">{f.name}</span>
                  <span className="text-label text-muted">{totalInFolder(folders, counts.byFolder, f._id)}</span>
                </button>
              </div>
            </li>
          );
        })}
        <li className="shrink-0">
          <button onClick={() => onView("none")} aria-current={view === "none" ? "true" : undefined} {...dropProps("none")} className={`${row("none", view === "none")} w-full`}>
            {icon("·")}
            <span className="min-w-0 flex-1 truncate">No folder</span>
            <span className="text-label text-muted">{counts.none}</span>
          </button>
        </li>
        <li className="shrink-0 md:pt-1">
          <button
            onClick={onNew}
            className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] px-2 py-1.5 text-left font-semibold text-accent-dark hover:bg-panel max-md:rounded-full max-md:border max-md:border-dashed max-md:border-[#c9b9a0] max-md:py-1"
          >
            <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-[7px] border-[1.5px] border-dashed border-[#c9b9a0]">
              +
            </span>
            New folder
          </button>
        </li>
      </ul>
    </nav>
  );
}

