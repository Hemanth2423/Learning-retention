"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { validateNoteImage } from "@/convex/reflectionRules";

export type NoteRow = {
  _id: Id<"notes">;
  _creationTime: number;
  sectionKey: string | null;
  content: string;
  plainText: string;
  seconds: number | null;
  updatedAt: number;
};
export type SavedRow = { _id: Id<"savedQuestions">; _creationTime: number; chapterKey: string; question: string; yourAnswer: string; rightAnswer: string; page?: number };

// The compose window: a new note (no noteId) or an existing one being edited. `draft` keeps what was typed while the
// window is minimised or the drawer is closed, so nothing typed is lost by moving around.
export type Compose = {
  noteId: Id<"notes"> | null;
  sectionKey: string | null; // null = General notes
  seconds: number | null; // video notes
  draft: { content: string; plainText: string } | null;
  initial: string | null; // the saved content when editing
  minimised: boolean;
  big: boolean;
};

const EMPTY = { notes: [] as NoteRow[], saved: [] as SavedRow[] };

// Everything the Notebook needs for one book: its notes and saved questions, the compose window, and the actions.
export function useNotebook(documentId: Id<"documents">) {
  const raw = useQuery(api.notebook.list, { documentId }) as typeof EMPTY | undefined;
  const data = raw ?? EMPTY;
  const loaded = raw !== undefined;
  const saveNote = useMutation(api.notebook.saveNote);
  const removeNote = useMutation(api.notebook.removeNote);
  const removeQuestion = useMutation(api.notebook.removeQuestion);
  const validate = useAction(api.chat.validateNote);
  const imageUploadUrl = useMutation(api.reflections.imageUploadUrl);
  const attachImage = useMutation(api.reflections.attachImage);
  const [compose, setCompose] = useState<Compose | null>(null);

  const write = useCallback((sectionKey: string | null, seconds: number | null = null) => {
    setCompose((cur) =>
      // An unsaved new note stays open (just moved to the new place) rather than being thrown away.
      cur && !cur.noteId && cur.draft?.plainText.trim() ? { ...cur, sectionKey, minimised: false } : { noteId: null, sectionKey, seconds, draft: null, initial: null, minimised: false, big: false }
    );
  }, []);
  const edit = useCallback((note: NoteRow) => {
    setCompose({ noteId: note._id, sectionKey: note.sectionKey, seconds: note.seconds, draft: null, initial: note.content, minimised: false, big: false });
  }, []);
  const patchCompose = useCallback((patch: Partial<Compose>) => setCompose((cur) => (cur ? { ...cur, ...patch } : cur)), []);
  const closeCompose = useCallback(() => setCompose(null), []);

  const save = useCallback(
    async (c: Compose) => {
      if (!c.draft) throw new Error("Nothing to save"); // the Save button is off until something changes
      const value = c.draft;
      return await saveNote({
        documentId,
        noteId: c.noteId ?? undefined,
        sectionKey: c.sectionKey ?? undefined,
        seconds: c.seconds ?? undefined,
        content: value.content,
        plainText: value.plainText,
      });
    },
    [saveNote, documentId]
  );

  // Uploads an image for a note and returns its link (or why it failed).
  const addImage = useCallback(
    async (file: File): Promise<{ ok: true; url: string } | { ok: false; message: string }> => {
      const problem = validateNoteImage({ size: file.size, contentType: file.type });
      if (problem) return { ok: false, message: problem };
      try {
        const res = await fetch(await imageUploadUrl(), { method: "POST", headers: { "Content-Type": file.type }, body: file });
        if (!res.ok) throw new Error("upload failed");
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        return await attachImage({ documentId, storageId });
      } catch {
        return { ok: false, message: "That image didn't upload. Try again." };
      }
    },
    [imageUploadUrl, attachImage, documentId]
  );

  return {
    documentId,
    loaded,
    notes: data.notes,
    saved: data.saved,
    compose,
    write,
    edit,
    patchCompose,
    closeCompose,
    save,
    removeNote: (noteId: Id<"notes">) => removeNote({ noteId }),
    removeQuestion: (savedId: Id<"savedQuestions">) => removeQuestion({ savedId }),
    validate,
    addImage,
  };
}
export type NotebookState = ReturnType<typeof useNotebook>;
