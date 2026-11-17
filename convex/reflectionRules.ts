// Pure rules for reflection notes. Tested in reflectionRules.test.ts.

export const MAX_NOTE_JSON = 60000; // the editor's saved format
export const MAX_NOTE_IMAGE_MB = 5;
export const MAX_NOTE_IMAGE_BYTES = MAX_NOTE_IMAGE_MB * 1024 * 1024;

// Only real images, up to 5 MB.
export function validateNoteImage(meta: { size: number; contentType?: string } | null): string | undefined {
  if (!meta || meta.size === 0) return "That image didn't upload. Try again.";
  if (!meta.contentType?.startsWith("image/")) return "That file isn't an image.";
  if (meta.size > MAX_NOTE_IMAGE_BYTES) return `Images can be up to ${MAX_NOTE_IMAGE_MB} MB.`;
  return undefined;
}
export const MAX_NOTE_TEXT = 10000; // the plain-text copy the AI will read

// A note with no words but an image still counts as written.
export function isEmptyNote(plainText: string, content = ""): boolean {
  return plainText.trim() === "" && !content.includes('"type":"image"');
}

export function validateNote(note: { content: string; plainText: string }): string | undefined {
  if (note.plainText.length > MAX_NOTE_TEXT) return `Keep a reflection under ${MAX_NOTE_TEXT.toLocaleString()} characters.`;
  if (note.content.length > MAX_NOTE_JSON) return "That note is too large to save.";
  try {
    const parsed = JSON.parse(note.content);
    if (!parsed || parsed.type !== "doc") return "That note couldn't be saved.";
  } catch {
    return "That note couldn't be saved.";
  }
  return undefined;
}
