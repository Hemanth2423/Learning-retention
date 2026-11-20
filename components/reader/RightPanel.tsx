"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { clampRightWidth, defaultRightWidth, RIGHT_MIN } from "./layout";

export type StudyTab = "ask" | "notes" | "highlights" | "more";
export type StudyTabSpec = { key: StudyTab; label: string; icon: ReactNode; count?: number; content: ReactNode };
const STORAGE_KEY = "ingrain.rightPanelWidth";

// The study tools drawer on the right: Ask, Notes, Highlights, More as tabs, and a handle on its left edge
// to drag it wider. The page next to it re-fits as the width changes. Width is remembered in this browser only.
export function RightPanel({
  tab,
  onTab,
  tabs,
  onClose,
  underMenu = true,
}: {
  underMenu?: boolean; // the PDF reader's menu floats over the drawer's top
  tab: StudyTab;
  onTab: (tab: StudyTab) => void;
  tabs: StudyTabSpec[];
  onClose: () => void;
}) {
  const [width, setWidth] = useState(() => {
    const fallback = defaultRightWidth(window.innerWidth);
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      return saved ? clampRightWidth(saved, window.innerWidth) : fallback;
    } catch {
      return fallback;
    }
  });
  const widthRef = useRef(width);
  const [dragging, setDragging] = useState(false);

  const apply = useCallback((w: number, persist: boolean) => {
    const next = clampRightWidth(w, window.innerWidth);
    widthRef.current = next;
    setWidth(next);
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* remembering the width is a convenience only */
      }
    }
  }, []);

  // Keep the panel within its limits if the window changes size.
  useEffect(() => {
    const onResize = () => apply(widthRef.current, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply]);

  const panelRef = useRef<HTMLElement>(null);
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !panelRef.current) return;
    apply(panelRef.current.getBoundingClientRect().right - e.clientX, false);
  };

  return (
    <aside ref={panelRef} id="right-panel" style={{ width }} className={`relative flex h-full shrink-0 flex-col border-l border-line bg-panel ${underMenu ? "pt-[60px]" : ""}`}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuenow={width}
        aria-valuemin={RIGHT_MIN}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          setDragging(false);
          apply(widthRef.current, true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") apply(widthRef.current + 24, true);
          if (e.key === "ArrowRight") apply(widthRef.current - 24, true);
        }}
        className={`absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize outline-none hover:bg-accent/40 focus-visible:bg-accent/60 ${dragging ? "bg-accent/60" : ""}`}
      />
      {/* A title row with the close button, then one segmented control: calm and easy to scan. */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
        <h2 className="font-serif text-[13px] font-bold uppercase tracking-[0.2em] text-accent">Study tools</h2>
        <button onClick={onClose} aria-label="Close study tools" title="Close (Esc)" className="grid h-8 w-8 place-items-center rounded-lg text-lg text-muted hover:bg-cream hover:text-ink">
          ✕
        </button>
      </div>
      <div role="tablist" aria-label="Study tools" className="mx-4 mb-3 grid shrink-0 gap-1 rounded-xl bg-cream p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => onTab(t.key)}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs transition ${
                on ? "bg-card font-semibold text-accent-dark shadow-sm ring-1 ring-line" : "font-medium text-muted hover:text-ink"
              }`}
            >
              <span aria-hidden="true" className="shrink-0">
                {t.icon}
              </span>
              <span className="truncate">{t.label}</span>
              {!!t.count && <span className="absolute right-1.5 top-1 rounded-full bg-line px-1.5 text-[10px] font-semibold leading-4 text-ink">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div className="h-px shrink-0 bg-line" />
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {tabs.find((t) => t.key === tab)?.content}
      </div>
      {/* While dragging, keep the page from stealing the pointer. */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </aside>
  );
}
