"use client";

import { useEffect, useRef } from "react";
import { ChapterRange, currentSectionKey, SectionLike } from "@/convex/chapters";
import { splitChapterTitle } from "./text";

type Section = SectionLike & { title: string };

// The contents, as a cream panel on the left: entries with dotted leaders and page numbers, ✓ on chapters read.
// A book with no contents lists its 20-page parts instead.
export function ContentsPanel({
  sections,
  ranges,
  readKeys,
  page,
  onJump,
  onClose,
}: {
  sections: Section[];
  ranges: ChapterRange[];
  readKeys: Set<string>;
  page: number;
  onJump: (page: number) => void;
  onClose: () => void;
}) {
  const entries = sections.length
    ? sections.map((s) => ({ key: s.key, title: s.title, level: s.level, page: s.locator.page }))
    : ranges.map((r) => ({ key: r.key, title: r.title, level: 1, page: r.startPage }));
  const currentKey = sections.length ? currentSectionKey(sections, page) : (ranges.filter((r) => r.startPage <= page).pop()?.key ?? null);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentKey]);

  return (
    <nav aria-label="Contents" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className="font-serif text-sm font-bold uppercase tracking-[0.2em] text-accent">Contents</h2>
        <button onClick={onClose} aria-label="Close contents" className="grid h-8 w-8 place-items-center rounded-lg text-lg text-muted hover:bg-panel hover:text-ink">
          ✕
        </button>
      </div>
      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-6 pt-2">
        {entries.map((e) => {
          const current = e.key === currentKey;
          const read = readKeys.has(e.key);
          const sub = e.level > 1;
          const { number, title } = splitChapterTitle(e.title);
          return (
            <li key={e.key}>
              <button
                ref={current ? currentRef : undefined}
                onClick={() => onJump(e.page)}
                aria-current={current ? "true" : undefined}
                title={e.title}
                style={{ paddingLeft: sub ? 12 + (e.level - 1) * 16 : 12 }}
                className={`flex w-full items-start gap-2.5 rounded-lg py-2 pr-3 text-left ${current ? "bg-accent-soft" : "hover:bg-accent/10"}`}
              >
                <span aria-hidden="true" className="mt-0.5 w-4 shrink-0 text-center text-[13px] leading-5">
                  {current ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-dark" /> : read ? <span className="font-bold text-good">✓</span> : ""}
                </span>
                <span
                  className={`line-clamp-2 min-w-0 flex-1 leading-5 ${sub ? "text-[13px] text-muted" : "text-[14.5px]"} ${current ? "font-semibold text-accent-dark" : sub ? "" : "text-ink"}`}
                >
                  {read && <span className="sr-only">Read: </span>}
                  {number ? `${number} · ${title}` : title}
                </span>
                <span className={`shrink-0 text-xs leading-5 ${current ? "font-semibold text-accent-dark" : "text-muted"}`}>{e.page}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
