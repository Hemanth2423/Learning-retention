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

import { chapterRanges, finishedChapter } from "./chapters";

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
  test("no contents, no chapters", () => expect(chapterRanges([], 30)).toEqual([]));
});

describe("finishedChapter", () => {
  const ranges = chapterRanges([named("a", 1), named("b", 10), named("c", 20)], 30);
  test("reading past a chapter's last page finishes it", () => {
    expect(finishedChapter(8, 9, ranges)?.key).toBe("a");
    expect(finishedChapter(18, 20, ranges)?.key).toBe("b");
    expect(finishedChapter(29, 30, ranges)?.key).toBe("c"); // the end of the book
  });
  test("moving within a chapter, or backwards, finishes nothing", () => {
    expect(finishedChapter(4, 5, ranges)).toBeNull();
    expect(finishedChapter(9, 8, ranges)).toBeNull();
    expect(finishedChapter(9, 9, ranges)).toBeNull();
  });
  test("a big jump (contents link, restored position) finishes nothing", () => {
    expect(finishedChapter(2, 25, ranges)).toBeNull();
    expect(finishedChapter(5, 10, ranges)).toBeNull();
  });
});
