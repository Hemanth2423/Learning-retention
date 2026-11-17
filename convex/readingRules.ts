// Pure rules for "how much have I read". Pages seen are kept as one character per page ("1" seen, "0" not),
// so a 344-page book is a 344-character string. Tested in readingRules.test.ts.
import { ChapterRange } from "./chapters";

export const MAX_SEEN_PER_SAVE = 50;

// Adds newly seen pages. Pages outside the book are ignored.
export function markPages(seen: string | undefined, pageCount: number, pages: number[]): string {
  const bits = (seen ?? "").padEnd(pageCount, "0").slice(0, pageCount).split("");
  for (const p of pages) if (Number.isInteger(p) && p >= 1 && p <= pageCount) bits[p - 1] = "1";
  return bits.join("");
}

export function seenBetween(seen: string | undefined, from: number, to: number): number {
  let n = 0;
  for (let p = from; p <= to; p++) if (seen?.[p - 1] === "1") n++;
  return n;
}

export function bookProgress(seen: string | undefined, pageCount: number): number {
  return pageCount > 0 ? Math.floor((seenBetween(seen, 1, pageCount) / pageCount) * 100) : 0;
}

// Per chapter: % of its pages seen, and "read" only when every page has been seen.
export function chapterProgress(ranges: ChapterRange[], seen: string | undefined) {
  return ranges.map((r) => {
    const total = r.endPage - r.startPage + 1;
    const got = seenBetween(seen, r.startPage, r.endPage);
    return { key: r.key, pct: Math.floor((got / total) * 100), read: got === total };
  });
}

// Where a chapter opens from the path: the page the reader left off on if it's in this chapter,
// otherwise the first page of the chapter they haven't read yet, otherwise (all read) its first page.
export function resumePage(range: ChapterRange, lastPage: number | null, seen: string | undefined): number {
  if (lastPage !== null && lastPage >= range.startPage && lastPage <= range.endPage) return lastPage;
  for (let p = range.startPage; p <= range.endPage; p++) if (seen?.[p - 1] !== "1") return p;
  return range.startPage;
}
