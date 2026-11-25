"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Shows the real page that holds a figure, drawn from the reader's own PDF. Nothing is generated or stored.
export function FigurePeek({ documentId, page, label }: { documentId: Id<"documents">; page: number; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" className="quiet" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"} {label}
      </button>
      {open && <PageCanvas documentId={documentId} page={page} label={label} />}
    </div>
  );
}

function PageCanvas({ documentId, page, label }: { documentId: Id<"documents">; page: number; label: string }) {
  const url = useQuery(api.documents.fileUrl, { documentId });
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let task: { destroy: () => Promise<void> } | null = null;
    let stopped = false;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const loading = pdfjs.getDocument({ url, disableAutoFetch: true });
      task = loading;
      const pdf = await loading.promise;
      const p = await pdf.getPage(page);
      const canvas = ref.current;
      if (stopped || !canvas) return;
      const viewport = p.getViewport({ scale: 1000 / p.getViewport({ scale: 1 }).width });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await p.render({ canvas, viewport }).promise;
    })().catch(() => !stopped && setFailed(true));
    return () => {
      stopped = true;
      void task?.destroy();
    };
  }, [url, page]);

  if (failed) return <p className="mt-2 text-meta text-muted">We couldn&apos;t draw this page. Use the page link instead.</p>;
  return <canvas ref={ref} role="img" aria-label={`Page ${page}, containing ${label}`} className="mt-2 max-h-[520px] w-auto max-w-full rounded-lg border border-line bg-white" />;
}
