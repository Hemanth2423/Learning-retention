"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { validateUpload } from "@/convex/documentRules";
import { SOURCES } from "./sources";

type Phase =
  | { name: "idle" }
  | { name: "uploading"; fileName: string; pct: number }
  | { name: "preparing"; documentId: Id<"documents"> }
  | { name: "error"; message: string };

// Browser fetch can't report upload progress, so this uses XMLHttpRequest.
function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText).storageId) : reject(new Error("upload failed"));
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.send(file);
  });
}

// The whole upload happens in this card: choose → uploading (with %) → preparing → the reader opens.
export function UploadCard() {
  const router = useRouter();
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const discard = useMutation(api.documents.discard);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const documentId = phase.name === "preparing" ? phase.documentId : null;
  const doc = useQuery(api.documents.get, documentId ? { documentId } : "skip");

  useEffect(() => {
    if (documentId && doc?.status === "ready") router.push(`/read/${documentId}`);
  }, [documentId, doc?.status, router]);

  const failed = phase.name === "preparing" && doc?.status === "failed";
  const errorMessage = phase.name === "error" ? phase.message : failed ? (doc?.statusMessage ?? "We couldn't read this PDF.") : null;

  async function start(file: File | undefined) {
    const problem = validateUpload(file ?? null);
    if (problem) return setPhase({ name: "error", message: problem });
    setPhase({ name: "uploading", fileName: file!.name, pct: 0 });
    try {
      const uploadUrl = await generateUploadUrl();
      const fileId = await putFile(uploadUrl, file!, (pct) => setPhase({ name: "uploading", fileName: file!.name, pct }));
      const res = await createDocument({ fileId, fileName: file!.name });
      if (!res.ok) return setPhase({ name: "error", message: res.message });
      setPhase({ name: "preparing", documentId: res.documentId });
    } catch {
      setPhase({ name: "error", message: "The upload didn't go through. Check your connection and try again." });
    }
  }

  async function tryAgain() {
    if (documentId) await discard({ documentId }).catch(() => {});
    setPhase({ name: "idle" });
  }

  const source = SOURCES[0];

  if (errorMessage) {
    return (
      <div className="card text-center" role="alert">
        <p className="font-medium text-bad">{errorMessage}</p>
        <button onClick={() => void tryAgain()} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  }

  if (phase.name === "uploading") {
    return (
      <div className="card" aria-live="polite">
        <p className="truncate text-sm font-medium">{phase.fileName}</p>
        <div
          role="progressbar"
          aria-valuenow={phase.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full bg-accent transition-[width]" style={{ width: `${phase.pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">Uploading… {phase.pct}%</p>
      </div>
    );
  }

  if (phase.name === "preparing") {
    return (
      <div className="card" aria-live="polite">
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        </div>
        <p className="mt-3 font-medium">Preparing your book…</p>
        <p className="text-sm text-muted">Getting the pages and contents ready. This can take a minute for a large book.</p>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void start(e.dataTransfer.files[0]);
      }}
      className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
        dragging ? "border-accent bg-accent-soft" : "border-line"
      }`}
    >
      <button onClick={() => inputRef.current?.click()} className="btn-primary px-6 py-3 text-base">
        {source.label}
      </button>
      <p className="text-sm text-muted">{source.hint}. Or drop it here.</p>
      <input
        ref={inputRef}
        type="file"
        accept={source.accept}
        className="sr-only"
        aria-label={source.label}
        onChange={(e) => {
          void start(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
