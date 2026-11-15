import { Locator } from "./locators";

export type SectionLike = { key: string; level: number; locator: Locator };

// The contents entry the reader is currently in: the last entry (in book order) that starts on or before this page.
// Pure so it can be tested; the reader and later features (highlight grouping, reflections) share it.
export function currentSectionKey(sections: SectionLike[], page: number): string | null {
  let current: string | null = null;
  for (const s of sections) {
    if (s.locator.page <= page) current = s.key;
  }
  return current;
}

// Which contents level counts as a "chapter": the top level, unless it has fewer than 3 entries
// (e.g. a single title entry), in which case the next level down.
export function chapterLevel(sections: SectionLike[]): number {
  const count = (level: number) => sections.filter((s) => s.level === level).length;
  if (count(1) >= 3) return 1;
  if (count(2) >= 3) return 2;
  return 1;
}

// The chapter a page belongs to, or null before the first chapter (or when there are no contents).
export function chapterOf<T extends SectionLike>(sections: T[], page: number): T | null {
  const level = chapterLevel(sections);
  let found: T | null = null;
  for (const s of sections) {
    if (s.level === level && s.locator.page <= page) found = s;
  }
  return found;
}

export type ChapterRange = { key: string; title: string; startPage: number; endPage: number };

// Each chapter with the pages it covers: from its own start to the page before the next chapter starts
// (the last chapter runs to the end of the book).
export function chapterRanges(sections: (SectionLike & { title: string })[], pageCount: number): ChapterRange[] {
  const level = chapterLevel(sections);
  const chapters = sections.filter((s) => s.level === level).sort((a, b) => a.locator.page - b.locator.page);
  return chapters.map((c, i) => {
    const next = chapters[i + 1];
    return {
      key: c.key,
      title: c.title,
      startPage: c.locator.page,
      endPage: next ? Math.max(c.locator.page, next.locator.page - 1) : Math.max(c.locator.page, pageCount),
    };
  });
}

// Reading past a chapter's last page counts as finishing it, but only for a small natural step.
// A big jump (a contents link, a restored position) is not reading, so it finishes nothing.
const MAX_READING_STEP = 3;

export function finishedChapter(previousBottomPage: number, bottomPage: number, ranges: ChapterRange[]): ChapterRange | null {
  if (bottomPage <= previousBottomPage || bottomPage - previousBottomPage > MAX_READING_STEP) return null;
  let found: ChapterRange | null = null;
  for (const r of ranges) {
    if (previousBottomPage < r.endPage && bottomPage >= r.endPage) found = r;
  }
  return found;
}
