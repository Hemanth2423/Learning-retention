"use client";

import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { chapterRanges } from "@/convex/chapters";
import { buildExport, exportFileName, ExportOptions, isEmptyExport, toMarkdown, toPrintHtml } from "@/convex/exportRules";

const today = () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

// Export: choose what to include, then download Markdown, print / save as PDF, or copy everything.
// Built in the browser from what's already loaded (convex/exportRules.ts); nothing is sent anywhere.
export function ExportSheet({ documentId, onClose }: { documentId: Id<"documents">; onClose: () => void }) {
  const doc = useQuery(api.documents.get, { documentId });
  const notebook = useQuery(api.notebook.list, { documentId });
  const highlights = useQuery(api.highlights.list, { documentId });
  const [options, setOptions] = useState<ExportOptions>({ notes: true, highlights: true, saved: true });
  const [done, setDone] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const book = useMemo(() => {
    if (!doc || !notebook || !highlights) return null;
    const ranges = chapterRanges(doc.sections ?? [], doc.pageCount ?? 0);
    const kind = doc.sourceType === "article" ? "Article" : doc.sourceType === "video" ? "Video" : null;
    return buildExport({
      title: doc.title,
      source: kind ? [kind, doc.siteName, doc.sourceUrl].filter(Boolean).join(" · ") : undefined,
      ranges,
      sections: doc.sections ?? [],
      notes: notebook.notes.map((n) => ({ sectionKey: n.sectionKey, content: n.content, plainText: n.plainText, seconds: n.seconds, createdAt: n._creationTime })),
      highlights: highlights.map((h) => ({
        page: h.locator.page,
        text: h.text,
        comment: h.comment,
        order: h.locator.page * 1e6 + (h.range ? h.range.startOffset : (h.segments[0]?.rects[0]?.y ?? 0) * 1e5),
      })),
      saved: notebook.saved.map((s) => ({ ...s, createdAt: s._creationTime })),
      options,
      pageLabel: doc.sourceType === "article" ? "§" : "p.",
    });
  }, [doc, notebook, highlights, options]);

  const counts = { notes: notebook?.notes.length ?? 0, highlights: highlights?.length ?? 0, saved: notebook?.saved.length ?? 0 };
  const empty = !book || isEmptyExport(book);

  function flash(message: string) {
    setDone(message);
    window.setTimeout(() => setDone(null), 2500);
  }

  function download() {
    if (!book) return;
    const blob = new Blob([toMarkdown(book, today())], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = exportFileName(book.title);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash("Downloaded");
  }

  // Print / Save as PDF: a hidden frame with a clean page, so the book and menus aren't printed.
  function print() {
    if (!book) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.srcdoc = toPrintHtml(book, today());
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  }

  async function copy() {
    if (!book) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(book, today()));
      flash("Copied");
    } catch {
      flash("Couldn't copy. Use Download instead.");
    }
  }

  const option = (key: keyof ExportOptions, label: string) => (
    <label className="flex items-center gap-2.5 rounded-[10px] border border-line bg-cream px-3 py-2">
      <input type="checkbox" checked={options[key]} onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.checked }))} className="h-4 w-4 accent-[var(--accent)]" />
      <span className="flex-1">{label}</span>
      <span className="text-meta text-muted">{counts[key]}</span>
    </label>
  );

  // In a portal, so no page layer (a sticky card, the drawer) can sit on top of it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/45 px-4 py-14" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="w-[min(520px,100%)] rounded-[18px] border-2 border-ink bg-card px-[22px] pb-[22px] pt-[18px] shadow-[0_6px_0_var(--ink)]">
        <div className="flex items-center justify-between">
          <h2 id="export-title" className="font-serif text-h2 font-bold">
            Export your notes
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="icon-btn">
            ✕
          </button>
        </div>
        <p className="mt-1 truncate text-meta text-muted">{doc?.title}</p>

        <p className="mt-4 text-label font-bold uppercase tracking-[0.08em] text-muted">Include</p>
        <div className="mt-1.5 grid gap-1.5">
          {option("notes", "✏️ Notes")}
          {option("highlights", "🖍 Highlights and comments")}
          {option("saved", "📓 Saved questions")}
        </div>

        {empty && book && <p className="empty-note !py-3">Nothing to export with these choices yet. Write a note or highlight something first.</p>}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button className="chunky sm" disabled={empty} onClick={download}>
            ⤓ Markdown
          </button>
          <button className="chunky sm chunky-light" disabled={empty} onClick={print} title="Opens your browser's print window: choose Save as PDF">
            🖨 PDF / Print
          </button>
          <button className="chunky sm chunky-light" disabled={empty} onClick={() => void copy()}>
            ⧉ Copy all
          </button>
        </div>
        <p className="mt-2 h-5 text-center text-meta font-semibold text-good" aria-live="polite">
          {done}
        </p>

        <p className="mt-2 text-label font-bold uppercase tracking-[0.08em] text-muted">Send to</p>
        <ul className="mt-1.5 grid gap-1.5 text-meta">
          {[
            ["Notion", "Coming soon"],
            ["Google Docs", "Coming soon"],
            ["Obsidian", "Soon · the Markdown file opens in Obsidian today"],
          ].map(([name, note]) => (
            <li key={name} className="flex items-center justify-between rounded-[10px] border border-dashed border-line px-3 py-2">
              <span className="font-semibold">{name}</span>
              <span className="text-muted">{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
}
