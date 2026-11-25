"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { MapNode, MindMapTree } from "@/components/MindMap";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ChapterRange, chapterLevel, SectionLike } from "@/convex/chapters";
import { readableTitle } from "./text";

type Props = {
  documentId: Id<"documents">;
  title: string;
  ranges: ChapterRange[];
  sections: (SectionLike & { title: string })[];
  currentKey: string | null;
  onJump: (page: number) => void;
  onClose: () => void;
};

// The book as a collapsible map: book → chapters → the chapter's key ideas (from its concept check) or,
// before a check exists, its sub-sections from the contents. Clicking a name jumps to its page.
export function BookMindMap({ documentId, title, ranges, sections, currentKey, onJump, onClose }: Props) {
  const ideas = useQuery(api.concepts.bookIdeas, { documentId });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const root = useMemo<MapNode>(() => {
    const go = (page: number) => () => {
      onJump(page);
      onClose();
    };
    const sub = chapterLevel(sections) + 1;
    return {
      id: "root",
      label: title,
      depth: 0,
      children: ranges.map((r) => {
        const found = ideas?.find((c) => c.chapterKey === r.key)?.ideas;
        const kids = found
          ? found.map((i) => ({ id: `${r.key}:${i.id}`, label: i.name, depth: 2, onPick: go(i.page), title: `${i.name} · p.${i.page}`, children: [] }))
          : sections
              .filter((s) => s.level === sub && s.locator.page >= r.startPage && s.locator.page <= r.endPage)
              .map((s) => ({ id: `${r.key}:${s.key}`, label: readableTitle(s.title), depth: 2, onPick: go(s.locator.page), children: [] }));
        return { id: r.key, label: readableTitle(r.title), depth: 1, onPick: go(r.startPage), children: kids };
      }),
    };
  }, [ideas, ranges, sections, title, onJump, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Mind map" className="max-h-[88vh] w-full max-w-[1100px] overflow-auto rounded-2xl border-2 border-ink bg-cream p-5 shadow-[0_5px_0_var(--ink)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex justify-end">
          <button onClick={onClose} className="icon-btn" aria-label="Close mind map" title="Close (Esc)">
            ✕
          </button>
        </div>
        {ideas === undefined ? (
          <p className="py-10 text-center text-muted">Loading…</p>
        ) : (
          <MindMapTree
            root={root}
            heading="Mind map"
            initialOpen={currentKey ? ["root", currentKey] : ["root"]}
            footer={<span>Click (+) to go deeper. Click a name to jump to its page. Chapters with a concept check show their key ideas.</span>}
          />
        )}
      </div>
    </div>
  );
}
