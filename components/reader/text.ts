// Small text helpers for the reader. Pure so they can be tested.

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs", "via"]);

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
    return keepSmall ? word : word[0].toUpperCase() + word.slice(1);
  });
}
