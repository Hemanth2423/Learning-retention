"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateUpload } from "@/convex/documentRules";
import { parseLink } from "@/convex/linkRules";
import { coverColour } from "@/components/library/BookCover";
import { FILE_HINT, FILE_ACCEPT, MAX_FILES_AT_ONCE, fileKindLabel, fileNote } from "./sources";

type Tab = "files" | "links";

// One pasted line, checked in the browser for instant feedback (the server checks again).
export function checkLinks(text: string) {
  const seen = new Set<string>();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      const link = parseLink(raw);
      if (!link) return { raw, problem: "Not an article or YouTube link" } as const;
      if (seen.has(link.url)) return { raw, link, problem: "Listed twice" } as const;
      seen.add(link.url);
      return { raw, link, problem: undefined };
    });
}

// "Add to your library": files (several at once) or links (one per line). Each item gets its own row and a
// reason if it can't be added; pressing Add hands the good ones to the corner queue.
// Mounted only while open, so each opening starts fresh (with any files dropped onto the Add card).
export function AddSheet({ initialFiles, onClose, onAdd }: { initialFiles?: File[]; onClose: () => void; onAdd: (files: File[], links: string[]) => void }) {
  const [tab, setTab] = useState<Tab>("files");
  const [files, setFiles] = useState<File[]>(() => (initialFiles ?? []).slice(0, MAX_FILES_AT_ONCE));
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileRows = files.map((f) => ({ file: f, problem: validateUpload(f), tooBig: f.size > MAX_UPLOAD_BYTES }));
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  const tooBig = fileRows.filter((r) => r.tooBig).length;
  const unusable = fileRows.filter((r) => r.problem).length;
  const linkRows = useMemo(() => checkLinks(text), [text]);
  const goodFiles = fileRows.filter((r) => !r.problem).map((r) => r.file);
  const goodLinks = linkRows.filter((r) => !r.problem).map((r) => r.link!.url);
  const count = goodFiles.length + goodLinks.length;
  const tooMany = files.length >= MAX_FILES_AT_ONCE;

  function pick(list: FileList | null) {
    // Copy now: the picker's FileList is emptied when the input is reset right after this call,
    // before React runs the update below (that made picked files vanish).
    const picked = Array.from(list ?? []);
    if (!picked.length) return;
    setFiles((cur) => [...cur, ...picked].slice(0, MAX_FILES_AT_ONCE));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink/45 px-4 py-14"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-title"
        className="w-[min(620px,100%)] rounded-[18px] border-2 border-ink bg-card px-[22px] pb-[22px] pt-[18px] shadow-[0_6px_0_var(--ink)]"
      >
        <div className="flex items-center justify-between">
          <h2 id="add-title" className="font-serif text-h2 font-bold">
            Add to your library
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="icon-btn">
            ✕
          </button>
        </div>
        <div role="tablist" aria-label="What to add" className="seg my-3.5">
          <button role="tab" aria-selected={tab === "files"} onClick={() => setTab("files")}>
            📄 Files{files.length ? ` · ${files.length}` : ""}
          </button>
          <button role="tab" aria-selected={tab === "links"} onClick={() => setTab("links")}>
            🔗 Links{linkRows.length ? ` · ${linkRows.length}` : ""}
          </button>
        </div>

        {tab === "files" ? (
          <div role="tabpanel">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files);
              }}
              className={`rounded-[14px] border-2 border-dashed p-5 text-center transition ${dragging ? "border-accent bg-accent-soft" : "border-[#b9a88f] bg-panel"}`}
            >
              <b className="mb-1 block font-serif text-h3">Drop files here, or choose several</b>
              <span className="text-meta text-muted">{FILE_HINT}</span>
              <div className="mt-2.5">
                <button type="button" className="quiet" onClick={() => inputRef.current?.click()} disabled={tooMany}>
                  Choose files
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={FILE_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Choose files"
                  onChange={(e) => {
                    pick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {tooMany && <p className="mt-2 text-meta text-accent-dark">That&apos;s {MAX_FILES_AT_ONCE}, the most at once. Add these, then the rest.</p>}
            {fileRows.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {fileRows.map((r, i) => (
                  <li
                    key={`${r.file.name}-${i}`}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2.5 rounded-[10px] border px-2.5 py-1.5 ${r.problem ? "border-bad/60 bg-accent-soft" : "border-line bg-cream"}`}
                  >
                    <span className="kind">{fileKindLabel(r.file.name)}</span>
                    <span className="truncate text-ui" title={r.file.name}>
                      {r.file.name}
                    </span>
                    <span className={`text-label tabular-nums ${r.tooBig ? "font-bold text-bad" : "text-muted"}`}>{formatSize(r.file.size)}</span>
                    <button className="icon-btn h-7 w-7" aria-label={`Remove ${r.file.name}`} onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                    {r.problem && <span className="col-start-2 col-end-5 -mt-0.5 text-label font-semibold text-bad">⚠️ {r.problem}</span>}
                    {!r.problem && fileNote(r.file.name) && <span className="col-start-2 col-end-5 -mt-0.5 text-label text-muted">{fileNote(r.file.name)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div role="tabpanel">
            <label htmlFor="add-links" className="text-meta text-muted">
              Paste links, one per line: articles or YouTube videos
            </label>
            <textarea
              id="add-links"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder={"https://paulgraham.com/greatwork.html\nhttps://www.youtube.com/watch?v=…"}
              className="input mt-1.5 min-h-[76px] resize-y"
            />
            {linkRows.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {linkRows.map((r, i) => (
                  <li
                    key={`${r.raw}-${i}`}
                    className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-2.5 rounded-[10px] border border-line bg-cream px-2.5 py-1.5"
                  >
                    <LinkPreview row={r} />
                    <span className="min-w-0">
                      <b className="block truncate font-serif" title={r.raw}>
                        {r.link ? (r.link.kind === "video" ? "YouTube video" : r.link.host.replace(/^www\./, "")) : r.raw}
                      </b>
                      <span className={`block truncate text-meta ${r.problem ? "text-accent-dark" : "text-muted"}`}>
                        {r.problem ??
                          (r.link?.kind === "video" ? "Video · title and channel come from YouTube" : "Article · read once, then kept in reader mode")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          {tab === "files" && files.length > 0 ? (
            // Checked while picking: the total, and how many can't be added (each file can be up to 25 MB).
            <span className="text-meta" aria-live="polite">
              <span className="text-muted">
                {files.length} file{files.length === 1 ? "" : "s"} · {formatSize(totalBytes)}
              </span>
              {unusable > 0 && (
                <span className="font-semibold text-bad">
                  {" "}
                  · {tooBig > 0 ? `${tooBig} over ${MAX_UPLOAD_MB} MB` : ""}
                  {tooBig > 0 && unusable > tooBig ? ", " : ""}
                  {unusable > tooBig ? `${unusable - tooBig} can't be read` : ""}: {unusable === 1 ? "it" : "they"} won&apos;t be added
                </span>
              )}
            </span>
          ) : (
            <span className="text-meta text-muted">Books get a chapter path and tests. Articles and videos: read or watch and take notes.</span>
          )}
          <button className="chunky shrink-0" disabled={count === 0} onClick={() => onAdd(goodFiles, goodLinks)}>
            {count === 0 ? "Add to library" : `Add ${count} to library`}
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkPreview({ row }: { row: ReturnType<typeof checkLinks>[number] }) {
  const box = "aspect-video w-[84px] overflow-hidden rounded-lg";
  if (row.link?.kind === "video")
    return (
      <span className={`${box} relative bg-ink`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${row.link.videoId}/mqdefault.jpg`} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      </span>
    );
  const host = row.link?.kind === "article" ? row.link.host.replace(/^www\./, "") : "?";
  return (
    <span
      className={`${box} grid place-items-center font-serif text-h3 font-bold text-[#f6eedf]`}
      style={{ background: row.link ? coverColour(host) : "var(--line)" }}
    >
      {host.charAt(0).toUpperCase()}
    </span>
  );
}

// "740 KB", "12.4 MB"
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
