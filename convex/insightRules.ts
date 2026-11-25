// Dashboard rules (tasks/feature-5-concept-check/7-map-and-dashboard.md). Pure code, tested in insightRules.test.ts.
import { chapterRanges, SectionLike } from "./chapters";
import { seenBetween } from "./readingRules";

type BookLike = { sections?: (SectionLike & { title: string })[]; pageCount?: number; pagesSeen?: string };

export type ChapterReading = { key: string; title: string; pages: number; seen: number; notes: number; highlights: number };

// Per chapter: pages seen, notes and highlights. Books without contents get 20-page parts (chapters.ts).
export function readingByChapter(book: BookLike, notes: { sectionKey?: string }[], highlightPages: number[]): ChapterReading[] {
  return chapterRanges(book.sections ?? [], book.pageCount ?? 0).map((r) => ({
    key: r.key,
    title: r.title,
    pages: r.endPage - r.startPage + 1,
    seen: seenBetween(book.pagesSeen, r.startPage, r.endPage),
    notes: notes.filter((n) => n.sectionKey === r.key).length,
    highlights: highlightPages.filter((p) => p >= r.startPage && p <= r.endPage).length,
  }));
}

// Answers per day for the last `days` days, oldest first, in the reader's time zone (minutes behind UTC, as
// Date.getTimezoneOffset gives it).
export function activityByDay(ats: { at: number; correct: boolean }[], now: number, tzOffsetMinutes: number, days = 14) {
  const local = (t: number) => Math.floor((t - tzOffsetMinutes * 60_000) / 86_400_000);
  const today = local(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: (today - days + 1 + i) * 86_400_000, right: 0, missed: 0 }));
  for (const a of ats) {
    const i = local(a.at) - (today - days + 1);
    if (i < 0 || i >= days) continue;
    if (a.correct) out[i].right++;
    else out[i].missed++;
  }
  return out;
}
