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

export const PART_PAGES = 20;

// A book with no contents is split into parts of 20 pages, which then work exactly like chapters (decisions/008).
export function partRanges(pageCount: number): ChapterRange[] {
  const parts: ChapterRange[] = [];
  for (let start = 1, i = 1; start <= pageCount; start += PART_PAGES, i++) {
    const end = Math.min(pageCount, start + PART_PAGES - 1);
    parts.push({ key: `part-${i}`, title: `Part ${i} · pages ${start}–${end}`, startPage: start, endPage: end });
  }
  return parts;
}

// Each chapter with the pages it covers: from its own start to the page before the next chapter starts
// (the last chapter runs to the end of the book). No contents: 20-page parts instead.
export function chapterRanges(sections: (SectionLike & { title: string })[], pageCount: number): ChapterRange[] {
  if (sections.length === 0) return partRanges(pageCount);
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
