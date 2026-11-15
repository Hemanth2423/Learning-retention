// Pure rules for reflection notes. Tested in reflectionRules.test.ts.

export const MAX_NOTE_JSON = 60000; // the editor's saved format
export const MAX_NOTE_TEXT = 10000; // the plain-text copy the AI will read

export function isEmptyNote(plainText: string): boolean {
  return plainText.trim() === "";
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
