import { describe, expect, test } from "vitest";
import { chapterRanges } from "./chapters";
import { bookProgress, chapterProgress, markPages, resumePage, seenBetween } from "./readingRules";

describe("pages seen", () => {
  test("marks pages, ignores pages outside the book, and keeps earlier marks", () => {
    let seen = markPages(undefined, 5, [1, 3, 9, 0, 2.5]);
    expect(seen).toBe("10100");
    seen = markPages(seen, 5, [5]);
    expect(seen).toBe("10101");
    expect(seenBetween(seen, 1, 3)).toBe(2);
  });
  test("book progress rounds down, so 100% means every page", () => {
    expect(bookProgress("1111111110", 10)).toBe(90);
    expect(bookProgress("1".repeat(299) + "0", 300)).toBe(99);
    expect(bookProgress("1".repeat(300), 300)).toBe(100);
    expect(bookProgress(undefined, 0)).toBe(0);
  });
  test("a chapter is read only when every page of it has been seen", () => {
    const at = (key: string, page: number) => ({ key, title: key, level: 1, locator: { kind: "pdf" as const, page } });
    const ranges = chapterRanges([at("a", 1), at("b", 4), at("c", 7)], 9);
    const seen = markPages(undefined, 9, [1, 2, 3, 4, 5, 9]);
    expect(chapterProgress(ranges, seen)).toEqual([
      { key: "a", pct: 100, read: true },
      { key: "b", pct: 66, read: false },
      { key: "c", pct: 33, read: false },
    ]);
  });

  test("a chapter opens where the reader left it", () => {
    const ch = { key: "c", title: "C", startPage: 21, endPage: 40 };
    const seen = markPages(undefined, 60, Array.from({ length: 9 }, (_, i) => 21 + i)); // pages 21–29 read
    expect(resumePage(ch, 27, seen)).toBe(27); // the last page they were on, when it's in this chapter
    expect(resumePage(ch, 55, seen)).toBe(30); // otherwise the first page they haven't read
    expect(resumePage(ch, null, undefined)).toBe(21); // never opened: the start
    expect(resumePage(ch, 55, markPages(undefined, 60, Array.from({ length: 20 }, (_, i) => 21 + i)))).toBe(21); // all read: the start
  });
});
