"use client";

import { useAction, useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { renderPdfCover, uploadImage } from "@/components/library/covers";
import { BLOCK_BATCH, kindOfFile } from "@/convex/textSourceRules";
import { readTextFile, ReadError } from "./readFile";

export type QueueState = "waiting" | "reading" | "uploading" | "adding" | "preparing" | "ready" | "failed";
export type QueueItem = {
  id: string;
  name: string;
  kind: "file" | "link";
  state: QueueState;
  pct?: number;
  message?: string; // why it failed, or a note ("Saved as a link")
  documentId?: Id<"documents">;
};
type Job = { id: string; run: () => Promise<void> };

// Browser fetch can't report upload progress, so this uses XMLHttpRequest.
function putFile(url: string, file: File, onProgress: (pct: number) => void): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(JSON.parse(xhr.responseText).storageId) : reject(new Error("upload failed")));
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.send(file);
  });
}

let nextId = 0;

// Everything added from the Add sheet goes through this queue, one item at a time, so twenty files or
// links don't all hit the network (or Firecrawl) at once. Each item reports its own state.
export function useAddQueue() {
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const createDocument = useMutation(api.documents.create);
  const setCover = useMutation(api.documents.setCover);
  const skipCover = useMutation(api.documents.skipCover);
  const addLink = useAction(api.links.add);
  const beginText = useMutation(api.textSources.begin);
  const addBlocks = useMutation(api.textSources.addBlocks);
  const finishText = useMutation(api.textSources.finish);
  const failText = useMutation(api.textSources.fail);
  const [items, setItems] = useState<QueueItem[]>([]);
  const jobs = useRef<Job[]>([]);
  const running = useRef(false);

  const update = useCallback((id: string, patch: Partial<QueueItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i))), []);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (jobs.current.length) await jobs.current.shift()!.run();
    running.current = false;
  }, []);

  // A cover is a nice-to-have: if drawing it fails, the plain-colour cover stays and nothing else changes.
  const makeCover = useCallback(
    async (documentId: Id<"documents">, data: ArrayBuffer) => {
      try {
        const image = await renderPdfCover({ data });
        if (!image) return void (await skipCover({ documentId }));
        const coverId = await uploadImage(await generateUploadUrl(), image);
        await setCover({ documentId, coverId: coverId as Id<"_storage"> });
      } catch (err) {
        console.warn("[covers] no cover for this file", err);
      }
    },
    [generateUploadUrl, setCover, skipCover],
  );

  // EPUB / Word / PowerPoint: read in the browser first (a file that can't be read fails here, nothing saved),
  // then upload the original, send the text in batches, and finish with the contents (and an EPUB's cover).
  const addTextFile = useCallback(
    async (id: string, file: File, kind: "epub" | "word" | "powerpoint") => {
      update(id, { state: "reading" });
      let read;
      try {
        read = await readTextFile(file, kind);
      } catch (err) {
        console.warn("[add] couldn't read", file.name, err);
        return update(id, { state: "failed", message: err instanceof ReadError ? err.message : "We couldn't read this file. It may be damaged." });
      }
      let documentId: Id<"documents"> | null = null;
      try {
        update(id, { state: "uploading", pct: 0 });
        const fileId = await putFile(await generateUploadUrl(), file, (pct) => update(id, { pct }));
        const started = await beginText({ fileId, fileName: file.name, kind, title: read.title.slice(0, 120) });
        if (!started.ok) return update(id, { state: "failed", message: started.message });
        documentId = started.documentId;
        update(id, { state: "preparing", documentId });
        for (let i = 0; i < read.blocks.length; i += BLOCK_BATCH) {
          const res = await addBlocks({ documentId, startIndex: i, blocks: read.blocks.slice(i, i + BLOCK_BATCH) });
          if (!res.ok) throw new ReadError(res.message);
        }
        let coverId: Id<"_storage"> | undefined;
        if (read.cover) coverId = (await uploadImage(await generateUploadUrl(), read.cover).catch(() => undefined)) as Id<"_storage"> | undefined;
        const done = await finishText({ documentId, sections: read.sections, coverId });
        if (!done.ok) throw new ReadError(done.message);
        update(id, { state: "ready", message: read.note });
      } catch (err) {
        const message = err instanceof ReadError ? err.message : "The upload didn't go through. Check your connection and try again.";
        if (documentId) await failText({ documentId, message }).catch(() => {});
        update(id, { state: "failed", message, documentId: documentId ?? undefined });
      }
    },
    [update, generateUploadUrl, beginText, addBlocks, finishText, failText],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = `q${nextId++}`;
        setItems((list) => [...list, { id, name: file.name, kind: "file", state: "waiting" }]);
        jobs.current.push({
          id,
          run: async () => {
            const kind = kindOfFile(file.name);
            if (kind && kind !== "pdf") return addTextFile(id, file, kind);
            try {
              update(id, { state: "uploading", pct: 0 });
              const fileId = await putFile(await generateUploadUrl(), file, (pct) => update(id, { pct }));
              const res = await createDocument({ fileId, fileName: file.name });
              if (!res.ok) return update(id, { state: "failed", message: res.message });
              update(id, { state: "preparing", documentId: res.documentId });
              void file.arrayBuffer().then((data) => makeCover(res.documentId, data));
            } catch {
              update(id, {
                state: "failed",
                message: "The upload didn't go through. Check your connection and try again.",
              });
            }
          },
        });
      }
      void pump();
    },
    [addTextFile, createDocument, generateUploadUrl, makeCover, pump, update],
  );

  const addLinks = useCallback(
    (urls: string[]) => {
      for (const url of urls) {
        const id = `q${nextId++}`;
        setItems((list) => [
          ...list,
          {
            id,
            name: url.replace(/^https?:\/\/(www\.)?/, ""),
            kind: "link",
            state: "waiting",
          },
        ]);
        jobs.current.push({
          id,
          run: async () => {
            update(id, { state: "adding" });
            const res = await addLink({ url }).catch(() => ({
              ok: false as const,
              message: "We couldn't add that link just now. Try again.",
            }));
            if (res.ok)
              update(id, {
                state: "ready",
                documentId: res.documentId,
                message: "savedAsLink" in res && res.savedAsLink ? "Saved as a link: this page needs a login or subscription." : undefined,
              });
            else
              update(id, {
                state: "failed",
                message: res.message,
                documentId: "documentId" in res ? res.documentId : undefined,
              });
          },
        });
      }
      void pump();
    },
    [addLink, pump, update],
  );

  const clearFinished = useCallback(() => setItems((list) => list.filter((i) => !["ready", "failed"].includes(i.state))), []);

  return { items, addFiles, addLinks, clearFinished, makeCover };
}
