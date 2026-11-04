"use client";

import { useRef, useState } from "react";

// Large (+) drop zone for a PDF. Wraps a real <input type="file" name="file"> so the form's
// FormData still picks the file up, whether it was clicked or dropped.
export function PdfDropzone({ invalid, describedBy }: { invalid?: boolean; describedBy?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files;
    if (dropped.length && inputRef.current) {
      inputRef.current.files = dropped;
      setFile(dropped[0]);
    }
  }

  return (
    <label
      htmlFor="file"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
        dragging ? "border-accent bg-accent-soft" : invalid ? "border-bad" : "border-line hover:border-accent hover:bg-accent-soft/50"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl font-light leading-none text-[#1E2A3A]"
      >
        {file ? "✓" : "+"}
      </span>
      {file ? (
        <span>
          <span className="block font-medium">{file.name}</span>
          <span className="text-sm text-muted">{file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`} · click to change</span>
        </span>
      ) : (
        <span>
          <span className="block font-medium">Add your PDF</span>
          <span className="text-sm text-muted">Drop it here or click to choose a chapter or slide deck</span>
        </span>
      )}
      <input
        ref={inputRef}
        id="file"
        name="file"
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
