// Pure rules for highlights: checking what the browser sends, and tidying the boxes. Tested in highlightRules.test.ts.

export const MAX_HIGHLIGHT_TEXT = 5000;
export const MAX_COMMENT = 2000;
export const MAX_HIGHLIGHTS_PER_DOCUMENT = 2000;
const MAX_PAGES_PER_HIGHLIGHT = 20;
const MAX_RECTS_PER_PAGE = 400;

// A box on a page, as fractions of the page's width and height (so it is right at any zoom).
export type Rect = { x: number; y: number; w: number; h: number };
// The boxes a highlight covers on one page. A highlight that crosses a page break has one segment per page.
export type Segment = { page: number; rects: Rect[] };

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const inUnit = (n: number) => Number.isFinite(n) && n >= -0.001 && n <= 1.001;

export function validateHighlight(input: { text: string; segments: Segment[]; pageCount: number }): string | undefined {
  const { text, segments, pageCount } = input;
  if (!normalizeText(text)) return "Select some text to highlight.";
  if (text.length > MAX_HIGHLIGHT_TEXT) return "That selection is too long to highlight.";
  if (segments.length === 0 || segments.length > MAX_PAGES_PER_HIGHLIGHT) return "That selection can't be highlighted.";
  for (const seg of segments) {
    if (!Number.isInteger(seg.page) || seg.page < 1 || seg.page > pageCount) return "That selection can't be highlighted.";
    if (seg.rects.length === 0 || seg.rects.length > MAX_RECTS_PER_PAGE) return "That selection can't be highlighted.";
    for (const r of seg.rects) {
      if (![r.x, r.y, r.w, r.h].every(inUnit) || r.w <= 0 || r.h <= 0) return "That selection can't be highlighted.";
    }
  }
  return undefined;
}

export function validateComment(comment: string): string | undefined {
  return comment.length > MAX_COMMENT ? `Keep comments under ${MAX_COMMENT.toLocaleString()} characters.` : undefined;
}

// The page a highlight belongs to (and where the left panel jumps): its first page.
export function firstPage(segments: Segment[]): number {
  return Math.min(...segments.map((s) => s.page));
}

// Text layers give one box per run of text. Join boxes on the same line so a highlight is one clean bar per line.
export function mergeRects(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: Rect[] = [];
  for (const r of sorted) {
    const prev = out[out.length - 1];
    if (prev) {
      const overlap = Math.min(prev.y + prev.h, r.y + r.h) - Math.max(prev.y, r.y);
      if (overlap > 0.5 * Math.min(prev.h, r.h) && r.x <= prev.x + prev.w + 0.01) {
        const x = Math.min(prev.x, r.x);
        const y = Math.min(prev.y, r.y);
        out[out.length - 1] = { x, y, w: Math.max(prev.x + prev.w, r.x + r.w) - x, h: Math.max(prev.y + prev.h, r.y + r.h) - y };
        continue;
      }
    }
    out.push(r);
  }
  return out;
}

// A highlight in a text source (article, EPUB, Word): from (startBlock, startOffset) to (endBlock, endOffset),
// offsets counted in each block's plain text. Blocks are numbered from 1.
export type TextRange = { startBlock: number; startOffset: number; endBlock: number; endOffset: number };

export function validateTextHighlight(input: { text: string; range: TextRange; blockCount: number }): string | undefined {
  const { text, range: r, blockCount } = input;
  if (!normalizeText(text)) return "Select some text to highlight.";
  if (text.length > MAX_HIGHLIGHT_TEXT) return "That selection is too long to highlight.";
  const ints = [r.startBlock, r.startOffset, r.endBlock, r.endOffset].every((n) => Number.isInteger(n) && n >= 0);
  if (!ints || r.startBlock < 1 || r.endBlock > blockCount) return "That highlight isn't in this text.";
  if (r.endBlock < r.startBlock || (r.endBlock === r.startBlock && r.endOffset <= r.startOffset)) return "That highlight isn't in this text.";
  return undefined;
}

