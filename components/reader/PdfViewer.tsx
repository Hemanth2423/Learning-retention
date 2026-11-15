"use client";

import "pdfjs-dist/web/pdf_viewer.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { mergeRects, normalizeText, Rect, Segment } from "@/convex/highlightRules";
import { PdfPage } from "./PdfPage";

export type JumpOptions = { y?: number; flashId?: string }; // y: where on the page (0–1) to bring into view
export type PdfViewerHandle = { jumpTo: (page: number, options?: JumpOptions) => void };
// What the reader has selected, with where to show the menu (screen coordinates).
export type SelectionInfo = { text: string; segments: Segment[]; x: number; y: number };

type Props = {
  url: string;
  pageCount: number;
  zoom: number; // 1 = fit the page to the reading column
  initialPage: number;
  highlights: { _id: string; segments: Segment[] }[];
  onPageChange: (page: number) => void;
  onSelection?: (selection: SelectionInfo | null) => void; // leave out to switch selecting off (scanned PDFs)
  // The last page whose bottom edge is on screen. `natural` is false while a jump or restore is settling.
  onReadProgress?: (bottomPage: number, natural: boolean) => void;
  onError: () => void;
};

const MAX_COLUMN = 860; // widest a page gets at 100% zoom
const GUTTER = 48;
const TOP_GAP = 16;
const CONTEXT_ABOVE = 120; // when jumping to a spot, show this much above it
const MAX_LINE_HEIGHT = 0.08; // fraction of the page; taller boxes are containers, not text

// Scrolls the pages of one PDF. Only pages near the screen are drawn, so long books stay fast.
export const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { url, pageCount, zoom, initialPage, highlights, onPageChange, onSelection, onReadProgress, onError },
  ref
) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [firstPage, setFirstPage] = useState<{ w: number; h: number } | null>(null);
  const [width, setWidth] = useState(0);
  const [dimsVersion, setDimsVersion] = useState(0);
  const pageDims = useRef(new Map<number, { w: number; h: number }>());
  const [near, setNear] = useState<Set<number>>(() => new Set());
  const nearRef = useRef(near);
  const [flashId, setFlashId] = useState<string | null>(null);
  const currentRef = useRef(initialPage);
  const pendingJump = useRef<{ page: number; y: number | null } | null>(null);
  const restored = useRef(false);
  const lastScale = useRef<number | null>(null);

  useEffect(() => {
    nearRef.current = near;
  }, [near]);

  // Load the PDF.
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void>; promise: Promise<PDFDocumentProxy> } | undefined;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      task = pdfjs.getDocument({ url });
      const loaded = await task.promise;
      const first = (await loaded.getPage(1)).getViewport({ scale: 1 });
      if (cancelled) return;
      setFirstPage({ w: first.width, h: first.height });
      setPdf(loaded);
    })().catch(() => {
      if (!cancelled) onError();
    });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, onError]);

  // Track the width of the reading area.
  useEffect(() => {
    if (!root) return;
    const ro = new ResizeObserver(() => setWidth(root.clientWidth));
    ro.observe(root);
    setWidth(root.clientWidth);
    return () => ro.disconnect();
  }, [root]);

  const scale = firstPage && width ? (Math.min(MAX_COLUMN, width - GUTTER) / firstPage.w) * zoom : 0;

  const onDims = useCallback((page: number, w: number, h: number) => {
    const known = pageDims.current.get(page);
    if (known && Math.abs(known.w - w) < 0.5 && Math.abs(known.h - h) < 0.5) return;
    pageDims.current.set(page, { w, h });
    setDimsVersion((v) => v + 1);
  }, []);

  const onNear = useCallback((page: number, isNear: boolean) => {
    setNear((prev) => {
      if (prev.has(page) === isNear) return prev;
      const next = new Set(prev);
      if (isNear) next.add(page);
      else next.delete(page);
      return next;
    });
  }, []);

  const pageEl = useCallback((page: number) => columnRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`) ?? null, []);

  const pageTop = useCallback(
    (page: number) => {
      const el = pageEl(page);
      return el && columnRef.current ? el.offsetTop + columnRef.current.offsetTop : null;
    },
    [pageEl]
  );

  // Where to scroll to bring a page (or a spot on it) into view.
  const scrollTarget = useCallback(
    (page: number, y: number | null) => {
      const top = pageTop(page);
      if (top === null) return null;
      if (y === null) return top - TOP_GAP;
      const height = pageEl(page)?.offsetHeight ?? 0;
      return Math.max(top - TOP_GAP, top + y * height - CONTEXT_ABOVE);
    },
    [pageTop, pageEl]
  );

  const jumpTo = useCallback(
    (page: number, options?: JumpOptions) => {
      const target = Math.min(Math.max(1, page), pageCount);
      const y = options?.y ?? null;
      pendingJump.current = { page: target, y };
      const to = scrollTarget(target, y);
      if (to !== null && root) root.scrollTo({ top: to });
      currentRef.current = target;
      onPageChange(target);
      setFlashId(options?.flashId ?? null);
    },
    [pageCount, scrollTarget, root, onPageChange]
  );

  useImperativeHandle(ref, () => ({ jumpTo }), [jumpTo]);

  // The flash is brief.
  useEffect(() => {
    if (!flashId) return;
    const timer = window.setTimeout(() => setFlashId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  // Pages whose real size differs from the estimate move the ones below them. Re-align a jump until the reader scrolls themselves.
  useLayoutEffect(() => {
    const pending = pendingJump.current;
    if (!pending || !root) return;
    const to = scrollTarget(pending.page, pending.y);
    if (to !== null) root.scrollTo({ top: to });
  }, [dimsVersion, scale, root, scrollTarget]);

  useEffect(() => {
    if (!root) return;
    const release = () => (pendingJump.current = null);
    const timer = window.setInterval(() => {
      if (pendingJump.current !== null) release();
    }, 2500);
    root.addEventListener("wheel", release, { passive: true });
    root.addEventListener("touchstart", release, { passive: true });
    root.addEventListener("keydown", release);
    root.addEventListener("pointerdown", release);
    return () => {
      window.clearInterval(timer);
      root.removeEventListener("wheel", release);
      root.removeEventListener("touchstart", release);
      root.removeEventListener("keydown", release);
      root.removeEventListener("pointerdown", release);
    };
  }, [root]);

  // Start on the page the reader left off, once the layout is ready.
  useLayoutEffect(() => {
    if (restored.current || !pdf || !scale || !root) return;
    restored.current = true;
    jumpTo(initialPage);
    lastScale.current = scale;
  }, [pdf, scale, root, initialPage, jumpTo]);

  // After a zoom, stay on the same page.
  useLayoutEffect(() => {
    if (!restored.current || !scale || lastScale.current === scale) return;
    lastScale.current = scale;
    jumpTo(currentRef.current);
  }, [scale, jumpTo]);

  // Work out which page the reader is on.
  useEffect(() => {
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = root.scrollTop + root.clientHeight * 0.3;
      let lo = 1;
      let hi = pageCount;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const top = pageTop(mid);
        if (top !== null && top <= probe) lo = mid;
        else hi = mid - 1;
      }
      if (lo !== currentRef.current && pendingJump.current === null) {
        currentRef.current = lo;
        onPageChange(lo);
      }
      if (onReadProgress) {
        const bottomEdge = root.scrollTop + root.clientHeight;
        const bottomOf = (n: number) => {
          const top = pageTop(n);
          const el = pageEl(n);
          return top !== null && el ? top + el.offsetHeight : Infinity;
        };
        let bl = 0;
        let bh = pageCount;
        while (bl < bh) {
          const mid = Math.ceil((bl + bh) / 2);
          if (bottomOf(mid) <= bottomEdge + 2) bl = mid;
          else bh = mid - 1;
        }
        onReadProgress(bl, pendingJump.current === null);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root, pageCount, pageTop, pageEl, onPageChange, onReadProgress]);

  // Selecting text: when the reader lets go of the mouse, work out the boxes the selection covers on each page.
  useEffect(() => {
    if (!root || !onSelection) return;
    const read = (): SelectionInfo | null => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return null;
      const text = normalizeText(sel.toString());
      if (!text) return null;

      const pages = [...nearRef.current].sort((a, b) => a - b).flatMap((n) => {
        const el = pageEl(n);
        return el ? [{ n, box: el.getBoundingClientRect() }] : [];
      });
      const byPage = new Map<number, Rect[]>();
      let anchor: { x: number; y: number } | null = null;
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const hit = pages.find((p) => cx >= p.box.left && cx <= p.box.right && cy >= p.box.top && cy <= p.box.bottom);
        if (!hit) continue;
        const clamp = (n: number) => Math.min(1, Math.max(0, n));
        const rect = {
          x: clamp((r.left - hit.box.left) / hit.box.width),
          y: clamp((r.top - hit.box.top) / hit.box.height),
          w: clamp(r.width / hit.box.width),
          h: clamp(r.height / hit.box.height),
        };
        if (rect.h > MAX_LINE_HEIGHT) continue;
        byPage.set(hit.n, [...(byPage.get(hit.n) ?? []), rect]);
        if (!anchor || r.top < anchor.y) anchor = { x: cx, y: r.top };
      }
      if (!anchor || byPage.size === 0) return null;
      const segments = [...byPage.entries()].sort((a, b) => a[0] - b[0]).map(([page, rects]) => ({ page, rects: mergeRects(rects) }));
      return { text, segments, x: anchor.x, y: anchor.y };
    };
    const onUp = () => window.setTimeout(() => onSelection(read()), 0);
    const hide = () => onSelection(null);
    root.addEventListener("mouseup", onUp);
    root.addEventListener("pointerdown", hide);
    root.addEventListener("scroll", hide, { passive: true });
    return () => {
      root.removeEventListener("mouseup", onUp);
      root.removeEventListener("pointerdown", hide);
      root.removeEventListener("scroll", hide);
    };
  }, [root, onSelection, pageEl]);

  const marksByPage = useMemo(() => {
    const map = new Map<number, { id: string; rects: Rect[] }[]>();
    for (const h of highlights) {
      for (const seg of h.segments) map.set(seg.page, [...(map.get(seg.page) ?? []), { id: h._id, rects: seg.rects }]);
    }
    return map;
  }, [highlights]);

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  void dimsVersion;
  const NO_MARKS: { id: string; rects: Rect[] }[] = [];

  return (
    <div
      ref={setRoot}
      tabIndex={0}
      aria-label="Book pages"
      className="relative min-w-0 flex-1 overflow-auto bg-line/30 outline-none"
    >
      {pdf && firstPage && scale > 0 ? (
        <div ref={columnRef} className="relative mx-auto flex w-max min-w-full flex-col items-center gap-4 px-6 py-4">
          {pages.map((n) => (
            <PdfPage
              key={n}
              pdf={pdf}
              pageNumber={n}
              scale={scale}
              dims={pageDims.current.get(n) ?? firstPage}
              near={near.has(n)}
              root={root}
              marks={marksByPage.get(n) ?? NO_MARKS}
              flashId={flashId}
              onDims={onDims}
              onNear={onNear}
            />
          ))}
        </div>
      ) : (
        <div className="mx-auto mt-4 w-full max-w-[860px] space-y-4 px-6" aria-label="Loading pages">
          {[0, 1].map((i) => (
            <div key={i} className="aspect-[8.5/11] animate-pulse rounded bg-card" />
          ))}
        </div>
      )}
    </div>
  );
});
