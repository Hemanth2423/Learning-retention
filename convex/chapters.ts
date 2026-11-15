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
