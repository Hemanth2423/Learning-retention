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
