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

import { chapterEntries, chapterLevel, chapterOf, chapterRanges } from "./chapters";

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
  test("a Part with chapters under it is replaced by those chapters (e.g. Designing Data-Intensive Applications)", () => {
    const t = (key: string, title: string, page: number, level = 1) => ({ key, title, level, locator: { kind: "pdf" as const, page } });
    const ddia = [
      t("pre", "Preface", 5),
      t("p1", "Part I. Foundations of Data Systems", 20),
      t("c1", "1. Reliable, Scalable, and Maintainable Applications", 22, 2),
      t("c1s", "Thinking About Data Systems", 23, 3),
      t("c2", "2. Data Models and Query Languages", 50, 2),
      t("p2", "Part II. Distributed Data", 140),
      t("c5", "5. Replication", 145, 2),
      t("p3", "PART THREE: Derived Data", 380),
      t("c10", "10. Batch Processing", 385, 2),
      t("gl", "Glossary", 540),
    ];
    expect(chapterEntries(ddia).map((c) => c.key)).toEqual(["pre", "c1", "c2", "c5", "c10", "gl"]);
    expect(chapterOf(ddia, 60)?.key).toBe("c2");
    expect(chapterRanges(ddia, 600).find((r) => r.key === "c2")).toMatchObject({ startPage: 50, endPage: 144 });
    // A "Part" with nothing under it, or a chapter that merely mentions a part, stays as it is.
    expect(chapterEntries([t("a", "Part 1", 1), t("b", "Spare parts", 5), t("c", "Three", 9)]).map((c) => c.key)).toEqual(["a", "b", "c"]);
  });
});


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
