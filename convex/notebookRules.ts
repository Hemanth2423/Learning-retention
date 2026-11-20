// Pure rules for the Notebook (notes, highlights and saved questions in one list). Tested in notebookRules.test.ts.
import { ChapterRange, SectionLike } from "./chapters";

export const MAX_NOTES_PER_DOCUMENT = 2000;
export const MAX_SAVED_PER_DOCUMENT = 500;
export const GENERAL = "general"; // the group key for notes that aren't about one chapter

export type NotebookFilter = "all" | "notes" | "highlights" | "saved";
export type NotebookItem =
  | { kind: "note"; id: string; chapterKey: string | null; text: string; order: number }
  | { kind: "highlight"; id: string; chapterKey: string | null; text: string; comment?: string; order: number }
  | { kind: "saved"; id: string; chapterKey: string | null; text: string; order: number };
export type NotebookGroup<T extends NotebookItem> = { key: string; title: string; part?: string; items: T[] };

const KIND_OF_FILTER: Record<Exclude<NotebookFilter, "all">, NotebookItem["kind"]> = { notes: "note", highlights: "highlight", saved: "saved" };

export function matchesFilter(item: NotebookItem, filter: NotebookFilter): boolean {
  return filter === "all" || item.kind === KIND_OF_FILTER[filter];
}

// Case-insensitive search over the item's text and comment.
export function matchesSearch(item: NotebookItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.text.toLowerCase().includes(q) || (item.kind === "highlight" && !!item.comment?.toLowerCase().includes(q));
}

// The Part a chapter sits in ("Part II · Replication"), if the contents group chapters into parts.
export function partOf(sections: (SectionLike & { title: string })[], chapterKey: string): string | undefined {
  const i = sections.findIndex((s) => s.key === chapterKey);
  if (i < 0) return undefined;
  for (let j = i - 1; j >= 0; j--) if (sections[j].level < sections[i].level) return sections[j].title;
  return undefined;
}

// Each chapter's Part, but only when the book really has Parts (two or more): a lone top-level entry is usually
// just the book's own title, not a Part.
export function chapterParts(sections: (SectionLike & { title: string })[], keys: string[]): Map<string, string> {
  const parts = new Map<string, string>();
  for (const k of keys) {
    const p = partOf(sections, k);
    if (p) parts.set(k, p);
  }
  return new Set(parts.values()).size >= 2 ? parts : new Map();
}

// Whole book: General notes first, then each chapter in book order (with its Part). Groups with nothing that
// matches are left out. General notes show only under All and Notes. Inside a group, items keep book order
// (highlights by position, notes and saved questions by time).
export function notebookGroups<T extends NotebookItem>(
  items: T[],
  ranges: ChapterRange[],
  sections: (SectionLike & { title: string })[],
  filter: NotebookFilter,
  query = ""
): NotebookGroup<T>[] {
  const shown = items.filter((i) => matchesFilter(i, filter) && matchesSearch(i, query));
  const groups: NotebookGroup<T>[] = [];
  const parts = chapterParts(sections, ranges.map((r) => r.key));
  if (filter === "all" || filter === "notes") {
    const general = shown.filter((i) => i.chapterKey === null || !ranges.some((r) => r.key === i.chapterKey));
    if (general.length) groups.push({ key: GENERAL, title: "General notes", items: sortItems(general) });
  }
  for (const r of ranges) {
    const inChapter = shown.filter((i) => i.chapterKey === r.key);
    if (inChapter.length) groups.push({ key: r.key, title: r.title, part: parts.get(r.key), items: sortItems(inChapter) });
  }
  return groups;
}

// Highlights first in reading order, then notes and saved questions oldest first.
function sortItems<T extends NotebookItem>(items: T[]): T[] {
  const rank = { highlight: 0, note: 1, saved: 2 } as const;
  return [...items].sort((a, b) => rank[a.kind] - rank[b.kind] || a.order - b.order);
}

// "12:05" or "1:02:03" for a video note's time.
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function validateSeconds(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 24 * 3600) return "That time isn't in the video.";
  return undefined;
}
