// Small text helpers for the reader. Pure so they can be tested.

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "via"]);
// Common acronyms stay in capitals when a shouty title is softened ("URL", not "Url").
const ACRONYMS = new Set(["ai", "api", "apis", "cdn", "cpu", "dns", "gpu", "http", "https", "id", "ids", "io", "ip", "json", "llm", "llms", "ml", "pdf", "qa", "sql", "tcp", "ui", "url", "urls", "ux", "xml"]);

// Book outlines often shout ("CHAPTER 10: DESIGN A NOTIFICATION SYSTEM"). Show those in title case so they're easy to read.
// Titles that already mix case are left alone.
export function readableTitle(title: string): string {
  const letters = title.replace(/[^A-Za-z]/g, "");
  if (letters.length < 4) return title;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (upper / letters.length < 0.8) return title;
  let first = true;
  return title.toLowerCase().replace(/[a-z][a-z']*/g, (word) => {
    const keepSmall = !first && SMALL_WORDS.has(word);
    first = false;
    if (ACRONYMS.has(word)) return word.endsWith("s") && word.length > 3 ? word.slice(0, -1).toUpperCase() + "s" : word.toUpperCase();
    return keepSmall ? word : word[0].toUpperCase() + word.slice(1);
  });
}

// "Chapter 8: Design a URL Shortener" → number "8", title "Design a URL Shortener". Titles without a chapter number stay as they are.
export function splitChapterTitle(raw: string): { number: string | null; title: string } {
  const title = readableTitle(raw);
  const m = /^\s*(?:chapter|ch\.?)\s*(\d+)\s*[:.\-–—]?\s*(.+)$/i.exec(title);
  return m ? { number: m[1], title: m[2] } : { number: null, title };
}

// The number shown for a stop on the path and on the end-of-chapter card: the book's own chapter number when the
// title has one ("Chapter 8: …" → "8"), "P3" for a 20-page part, and "•" for unnumbered entries like a foreword.
export function chapterBadge(title: string, index: number, isPart: boolean): string {
  if (isPart) return `P${index + 1}`;
  return splitChapterTitle(title).number ?? "•";
}
