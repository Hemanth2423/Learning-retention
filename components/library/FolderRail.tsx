"use client";

import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { MAX_FOLDER_NAME } from "@/convex/folderRules";
import { FolderOption, ITEM_DRAG_TYPE } from "./BookTile";

export type FolderView = "all" | "none" | Id<"folders">;

// The folder rail beside "Your library" (prototype 008, layout C). On wide screens a sticky card; on phones a
// row of chips. Every folder (and "No folder") takes dropped library items, and files dropped from the computer.
export function FolderRail({
  folders,
  counts,
  view,
  dragging,
  onView,
  onCreate,
  onDropItems,
  onDropFiles,
}: {
  folders: FolderOption[];
  counts: { all: number; none: number; byFolder: Map<string, number> };
  view: FolderView;
  dragging: boolean; // an item is being dragged: show where it can go
  onView: (v: FolderView) => void;
  onCreate: (name: string) => Promise<string | null>; // returns why it failed, or null
  onDropItems: (ids: Id<"documents">[], folderId: Id<"folders"> | null) => void;
  onDropFiles: (files: File[], folderId: Id<"folders"> | null) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return setCreating(false);
    const err = await onCreate(name);
    if (err) return setProblem(err);
    setCreating(false);
    setName("");
    setProblem(null);
  }

  const rows: { id: FolderView; name: string; emoji: string; colour?: string; count: number }[] = [
    { id: "all", name: "All items", emoji: "📚", count: counts.all },
    ...folders.map((f) => ({ id: f._id, name: f.name, emoji: f.emoji, colour: f.colour, count: counts.byFolder.get(f._id) ?? 0 })),
    { id: "none", name: "No folder", emoji: "·", count: counts.none },
  ];

  const dropProps = (id: FolderView) =>
    id === "all"
      ? {}
      : {
          onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes(ITEM_DRAG_TYPE) && !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
            setOver(id);
          },
          onDragLeave: () => setOver((o) => (o === id ? null : o)),
          onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setOver(null);
            const target = id === "none" ? null : (id as Id<"folders">);
            const raw = e.dataTransfer.getData(ITEM_DRAG_TYPE);
            if (raw) onDropItems(JSON.parse(raw) as Id<"documents">[], target);
            else if (e.dataTransfer.files.length) onDropFiles(Array.from(e.dataTransfer.files), target);
          },
        };

  return (
    <nav aria-label="Folders" className="md:sticky md:top-[76px] md:rounded-2xl md:border md:border-line md:bg-card md:px-2.5 md:py-3">
      <p className="mb-2 hidden px-2 text-label font-bold uppercase tracking-[0.08em] text-muted md:block">Library</p>
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:block md:space-y-0.5 md:overflow-visible md:px-0 md:pb-0">
        {rows.map((r, i) => {
          const current = view === r.id;
          const target = dragging && r.id !== "all";
          return (
            <li key={r.id} className={`shrink-0 ${i === 0 ? "md:mb-2 md:border-b md:border-line md:pb-2" : ""}`}>
              <button
                onClick={() => onView(r.id)}
                aria-current={current ? "true" : undefined}
                {...dropProps(r.id)}
                className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] border px-2.5 py-1.5 text-left transition ${
                  over === r.id
                    ? "border-2 border-dashed border-accent bg-accent-soft"
                    : current
                      ? "border-line bg-white font-semibold text-accent-dark shadow-[0_1px_2px_rgba(42,34,27,.08)]"
                      : target
                        ? "border-dashed border-[#c9b9a0] bg-panel/60"
                        : "border-transparent hover:bg-panel"
                } max-md:rounded-full max-md:border-line max-md:bg-card max-md:py-1`}
              >
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-meta text-white"
                  style={{ background: r.colour ?? "var(--panel)", color: r.colour ? "#fff" : "var(--muted)" }}
                >
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="text-label text-muted">{r.count}</span>
              </button>
            </li>
          );
        })}
        <li className="shrink-0">
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
              className="flex gap-1.5 p-0.5"
            >
              <input
                autoFocus
                value={name}
                maxLength={MAX_FOLDER_NAME}
                onChange={(e) => {
                  setName(e.target.value);
                  setProblem(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCreating(false);
                    setProblem(null);
                  }
                }}
                placeholder="Folder name"
                aria-label="New folder name"
                aria-invalid={!!problem}
                className="input min-w-0 flex-1 px-2 py-1 text-meta"
              />
              <button type="submit" className="quiet">
                Add
              </button>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-[10px] px-2.5 py-1.5 text-left font-semibold text-accent-dark hover:bg-panel max-md:rounded-full max-md:border max-md:border-dashed max-md:border-[#c9b9a0] max-md:py-1"
            >
              <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-[7px] border-[1.5px] border-dashed border-[#c9b9a0]">
                +
              </span>
              New folder
            </button>
          )}
          {problem && (
            <p role="alert" className="px-2 pt-1 text-label text-bad">
              {problem}
            </p>
          )}
        </li>
      </ul>
      <p className="mt-2.5 hidden px-2 text-label leading-relaxed text-muted md:block">
        Drag an item onto a folder, or right-click it → <b>Move to</b>. Drop files from your computer on a folder to add them straight into it.
      </p>
    </nav>
  );
}
