"use client";

import type { PDFDocumentProxy, RenderTask, TextLayer } from "pdfjs-dist";
import { memo, useEffect, useRef } from "react";
import type { Rect } from "@/convex/highlightRules";
import { registerTextLayer } from "./textSelection";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number; // CSS pixels per PDF point
  dims: { w: number; h: number }; // page size in PDF points (an estimate until the page is drawn)
  near: boolean; // close to the screen: draw it. Otherwise leave an empty sheet of the right size.
  root: HTMLElement | null;
  marks: { id: string; rects: Rect[] }[]; // highlights on this page
  flashId: string | null;
  onDims: (page: number, w: number, h: number) => void;
  onNear: (page: number, near: boolean) => void;
};

// One page: a sheet of the right size that draws its canvas and selectable text only while it's near the screen.
// Memoised: scrolling updates the reader's state constantly, and a long book must not re-render every page for it.
export const PdfPage = memo(function PdfPage({ pdf, pageNumber, scale, dims, near, root, marks, flashId, onDims, onNear }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Tell the viewer when this page is within ~1.5 screens of the visible area.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !root) return;
    // Several records can arrive in one batch (e.g. a page scrolled past before the first report); the last one is current.
    const io = new IntersectionObserver((entries) => onNear(pageNumber, entries[entries.length - 1].isIntersecting), {
      root,
      rootMargin: "150% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [root, pageNumber, onNear]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textBox = textRef.current;
    if (!near || !canvas || !textBox) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    let text: TextLayer | undefined;
    let unregister: (() => void) | undefined;

    (async () => {
      const { TextLayer } = await import("pdfjs-dist");
      const page = await pdf.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      onDims(pageNumber, unscaled.width, unscaled.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const sharp = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(sharp.width);
      canvas.height = Math.floor(sharp.height);
      task = page.render({ canvas, viewport: sharp });
      await task.promise;
      if (cancelled) return;
      textBox.replaceChildren();
      text = new TextLayer({ textContentSource: page.streamTextContent(), container: textBox, viewport: page.getViewport({ scale }) });
      await text.render();
      if (!cancelled) unregister = registerTextLayer(textBox);
    })().catch((err) => {
      // A cancelled draw (scrolled away or zoomed) is expected; anything else is worth knowing about.
      if ((err as { name?: string })?.name !== "RenderingCancelledException") console.error("[reader] page draw failed", pageNumber, err);
    });

    return () => {
      cancelled = true;
      task?.cancel();
      text?.cancel();
      unregister?.();
      canvas.width = 0; // frees the memory of pages that scrolled far away
      canvas.height = 0;
      textBox.replaceChildren();
    };
  }, [near, pdf, pageNumber, scale, onDims]);

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="relative shrink-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,.18),0_4px_14px_rgba(0,0,0,.10)]"
      style={{ width: dims.w * scale, height: dims.h * scale }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      {marks.map((m) =>
        m.rects.map((r, i) => (
          <div
            key={`${m.id}-${i}`}
            data-highlight={m.id}
            aria-hidden="true"
            className={`pointer-events-none absolute rounded-[2px] bg-yellow-300/50 mix-blend-multiply ${flashId === m.id ? "hl-flash" : ""}`}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
          />
        ))
      )}
      <div
        ref={textRef}
        className="textLayer"
        style={{ ["--total-scale-factor" as string]: scale, ["--scale-factor" as string]: scale }}
      />
    </div>
  );
});
