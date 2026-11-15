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
