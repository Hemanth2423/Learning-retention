"use client";

import { useState } from "react";
import { IconButton, Icons } from "./Tooltip";

const button = "flex h-8 w-8 items-center justify-center rounded-md text-white/90 hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent";

// The floating page and zoom control at the bottom of the book: ‹ [12] of 240 › | − +
export function PageNav({
  page,
  pageCount,
  onGo,
  zoomPercent,
  onZoomOut,
  onZoomIn,
  canZoomOut,
  canZoomIn,
}: {
  page: number;
  pageCount: number;
  onGo: (page: number) => void;
  zoomPercent: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  canZoomOut: boolean;
  canZoomIn: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null); // the typed page, while the box is being edited

  function commit() {
    const n = Number(draft);
    if (draft !== null && Number.isInteger(n) && n >= 1 && n <= pageCount && n !== page) onGo(n);
    setDraft(null);
  }

  return (
    <nav
      aria-label="Pages and zoom"
      className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-black/75 px-1.5 py-1 text-ui text-white shadow-lg backdrop-blur transition-opacity hover:opacity-100 focus-within:opacity-100 opacity-80"
    >
      <IconButton label="Previous page" onClick={() => onGo(page - 1)} disabled={page <= 1} className={button}>
        {Icons.prev}
      </IconButton>
      <label className="flex items-center gap-1.5 px-1">
        <span className="sr-only">Page</span>
        <input
          value={draft ?? String(page)}
          inputMode="numeric"
          onFocus={(e) => {
            setDraft(String(page));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          className="h-7 w-11 rounded-md bg-white/15 text-center tabular-nums outline-none focus:bg-white/25"
        />
        <span className="tabular-nums text-white/80">of {pageCount}</span>
      </label>
      <IconButton label="Next page" onClick={() => onGo(page + 1)} disabled={page >= pageCount} className={button}>
        {Icons.next}
      </IconButton>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/25" />
      <IconButton label={`Zoom out (${zoomPercent}%)`} onClick={onZoomOut} disabled={!canZoomOut} className={button}>
        {Icons.minus}
      </IconButton>
      <IconButton label={`Zoom in (${zoomPercent}%)`} onClick={onZoomIn} disabled={!canZoomIn} className={button}>
        {Icons.plus}
      </IconButton>
    </nav>
  );
}
