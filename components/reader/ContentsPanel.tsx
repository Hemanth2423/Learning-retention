"use client";

import { useEffect, useRef } from "react";
import { currentSectionKey, SectionLike } from "@/convex/chapters";

type Section = SectionLike & { title: string };

export function ContentsPanel({ sections, page, onJump }: { sections: Section[]; page: number; onJump: (page: number) => void }) {
  const currentKey = currentSectionKey(sections, page);
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentKey]);

  return (
    <nav aria-label="Contents" className="h-full w-72 shrink-0 overflow-y-auto border-r border-line bg-card py-3">
      <h2 className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Contents</h2>
      {sections.length === 0 ? (
        <p className="px-4 text-sm text-muted">No contents found</p>
      ) : (
        <ul>
          {sections.map((s) => {
            const current = s.key === currentKey;
            return (
              <li key={s.key}>
                <button
                  ref={current ? currentRef : undefined}
                  onClick={() => onJump(s.locator.page)}
                  aria-current={current ? "true" : undefined}
                  style={{ paddingLeft: 16 + (s.level - 1) * 14 }}
                  className={`flex w-full items-baseline justify-between gap-3 py-1.5 pr-4 text-left text-sm hover:bg-accent-soft ${
                    current ? "bg-accent-soft font-medium" : ""
                  }`}
                >
                  <span className="min-w-0">{s.title}</span>
                  <span className="shrink-0 text-xs text-muted">{s.locator.page}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
