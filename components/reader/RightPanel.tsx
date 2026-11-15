"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { clampRightWidth, defaultRightWidth, RIGHT_MIN } from "./layout";

export type RightTab = "chat" | "reflections";
const STORAGE_KEY = "ingrain.rightPanelWidth";

// The right panel: a Chat | Reflections switch, and a handle on its left edge to drag it wider.
// The page area next to it re-fits as the width changes. Width is remembered in this browser only.
export function RightPanel({
  tab,
  onTab,
  chatAvailable,
  chat,
  reflections,
}: {
  tab: RightTab;
  onTab: (tab: RightTab) => void;
  chatAvailable: boolean;
  chat: ReactNode;
  reflections: ReactNode;
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
    <aside ref={panelRef} id="right-panel" style={{ width }} className="relative flex h-full shrink-0 flex-col border-l border-line bg-card">
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
      <div role="tablist" aria-label="Right panel" className="flex shrink-0 gap-1 border-b border-line p-2">
        {chatAvailable && (
          <button role="tab" aria-selected={tab === "chat"} onClick={() => onTab("chat")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "chat" ? "bg-accent-soft" : "text-muted hover:text-ink"}`}>
            Chat
          </button>
        )}
        <button role="tab" aria-selected={tab === "reflections"} onClick={() => onTab("reflections")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === "reflections" ? "bg-accent-soft" : "text-muted hover:text-ink"}`}>
          Reflections
        </button>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto">
        {tab === "chat" && chatAvailable ? chat : reflections}
      </div>
      {/* While dragging, keep the page from stealing the pointer. */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </aside>
  );
}
