// Pure rules for uploads and prepared documents. Shared by the upload page (instant feedback)
// and the server (so the rules can't be skipped). Tested in documentRules.test.ts.

export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function validateUpload(file: { name: string; type: string; size: number } | null): string | undefined {
  if (!file || file.size === 0) return "Choose a PDF to upload.";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
    return "That file isn't a PDF. Choose a PDF and try again.";
  if (file.size > MAX_UPLOAD_BYTES) return `That PDF is over ${MAX_UPLOAD_MB} MB. Try a smaller file.`;
  return undefined;
}

// A page counts as readable text if it has this many non-space characters.
const MIN_PAGE_CHARS = 40;
// A document is "scanned" (image only) when fewer than this share of its pages have readable text.
const MIN_TEXT_PAGE_SHARE = 0.2;

export function hasReadableText(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return false;
  const withText = pageTexts.filter((t) => t.replace(/\s/g, "").length >= MIN_PAGE_CHARS).length;
  return withText / pageTexts.length >= MIN_TEXT_PAGE_SHARE;
}

export function documentTitle(metaTitle: string | undefined, fileName: string): string {
  const fromMeta = (metaTitle ?? "").trim();
  const fromFile = fileName.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim();
  const title = fromMeta.length >= 3 ? fromMeta : fromFile || "Untitled";
  return title.slice(0, 120);
}

// Covers are small images the browser makes (a PDF's first page, an EPUB's cover).
export const MAX_COVER_BYTES = 1024 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateCover(file: { contentType?: string; size: number } | null): string | undefined {
  if (!file || file.size === 0) return "No cover image was uploaded.";
  if (!file.contentType || !COVER_TYPES.includes(file.contentType)) return "A cover must be a JPEG, PNG, WebP or GIF image.";
  if (file.size > MAX_COVER_BYTES) return "That cover image is too large.";
  return undefined;
}

// A first page counts as a cover when enough of it is ink or colour. Text and title pages are mostly white
// (about 3–12% ink); real covers are mostly picture. `inkShare` is the share of sampled pixels that aren't near-white.
export const MIN_COVER_INK = 0.2;
export function looksLikeCover(inkShare: number): boolean {
  return inkShare >= MIN_COVER_INK;
}

export const MAX_TITLE = 120;

export function validateTitle(title: string): string | undefined {
  const t = title.trim();
  if (!t) return "Give the book a title.";
  if (t.length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  return undefined;
}

// Library order: the book read most recently first; books never opened sort by when they were added.
export function libraryOrder<T extends { lastReadAt?: number; _creationTime: number }>(books: T[]): T[] {
  return [...books].sort((a, b) => (b.lastReadAt ?? b._creationTime) - (a.lastReadAt ?? a._creationTime));
}
