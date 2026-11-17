import { describe, expect, test } from "vitest";
import { currentSectionKey } from "./chapters";

const at = (key: string, page: number, level = 1) => ({ key, level, locator: { kind: "pdf" as const, page } });
const sections = [at("s0", 1), at("s1", 2, 2), at("s2", 5, 2), at("s3", 8), at("s4", 9, 2)];

describe("currentSectionKey", () => {
  test("picks the last entry that starts on or before the page", () => {
    expect(currentSectionKey(sections, 1)).toBe("s0");
    expect(currentSectionKey(sections, 2)).toBe("s1");
    expect(currentSectionKey(sections, 4)).toBe("s1");
    expect(currentSectionKey(sections, 5)).toBe("s2");
    expect(currentSectionKey(sections, 8)).toBe("s3");
    expect(currentSectionKey(sections, 12)).toBe("s4");
  });
  test("before the first entry, or with no contents, there is no current entry", () => {
    expect(currentSectionKey([at("a", 3)], 2)).toBeNull();
    expect(currentSectionKey([], 5)).toBeNull();
  });
});

import { chapterLevel, chapterOf } from "./chapters";

describe("chapterOf", () => {
  test("uses top-level entries as chapters when there are at least 3", () => {
    const many = [at("a", 1), at("b", 2, 2), at("c", 10), at("d", 20), at("e", 21, 2)];
    expect(chapterLevel(many)).toBe(1);
    expect(chapterOf(many, 15)?.key).toBe("c");
    expect(chapterOf(many, 21)?.key).toBe("d");
  });
  test("with a single title entry on top, chapters are the next level down", () => {
    const book = [at("title", 1), at("c1", 3, 2), at("c2", 30, 2), at("c3", 60, 2), at("s", 31, 3)];
    expect(chapterLevel(book)).toBe(2);
    expect(chapterOf(book, 40)?.key).toBe("c2");
    expect(chapterOf(book, 2)).toBeNull(); // before the first chapter
  });
  test("no contents means no chapters", () => expect(chapterOf([], 5)).toBeNull());
});

import { chapterRanges } from "./chapters";

const named = (key: string, page: number, level = 1) => ({ key, level, title: key.toUpperCase(), locator: { kind: "pdf" as const, page } });

describe("chapterRanges", () => {
  const sections = [named("a", 1), named("a1", 3, 2), named("b", 10), named("c", 20)];
  test("each chapter runs to the page before the next; the last to the end of the book", () => {
    expect(chapterRanges(sections, 30).map((r) => [r.key, r.startPage, r.endPage])).toEqual([
      ["a", 1, 9],
      ["b", 10, 19],
      ["c", 20, 30],
    ]);
  });
  test("no contents: 20-page parts instead of chapters", () => {
    expect(chapterRanges([], 45).map((r) => [r.key, r.title, r.startPage, r.endPage])).toEqual([
      ["part-1", "Part 1 · pages 1–20", 1, 20],
      ["part-2", "Part 2 · pages 21–40", 21, 40],
      ["part-3", "Part 3 · pages 41–45", 41, 45],
    ]);
    expect(chapterRanges([], 0)).toEqual([]);
  });
});
