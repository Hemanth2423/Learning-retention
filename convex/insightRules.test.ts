import { describe, expect, test } from "vitest";
import { activityByDay, readingByChapter } from "./insightRules";

const sections = [
  { key: "a", title: "One", level: 1, locator: { kind: "pdf" as const, page: 1 } },
  { key: "b", title: "Two", level: 1, locator: { kind: "pdf" as const, page: 4 } },
];

describe("reading by chapter", () => {
  test("counts pages seen, notes and highlights inside each chapter", () => {
    const rows = readingByChapter({ sections, pageCount: 6, pagesSeen: "111100" }, [{ sectionKey: "a" }, { sectionKey: "b" }, { sectionKey: "a" }], [2, 5, 9]);
    expect(rows).toEqual([
      { key: "a", title: "One", pages: 3, seen: 3, notes: 2, highlights: 1 },
      { key: "b", title: "Two", pages: 3, seen: 1, notes: 1, highlights: 1 },
    ]);
  });
  test("a book without contents is split into parts; an empty source has none", () => {
    expect(readingByChapter({ pageCount: 2, pagesSeen: "10" }, [{}], [1])).toMatchObject([{ pages: 2, seen: 1, notes: 0, highlights: 1 }]);
    expect(readingByChapter({}, [], [])).toEqual([]);
  });
});

describe("activity by day", () => {
  const D = 86_400_000;
  const now = Date.UTC(2026, 10, 24, 12);
  test("buckets answers by the reader's local day, oldest first", () => {
    const out = activityByDay([{ at: now, correct: true }, { at: now - D, correct: false }, { at: now - 30 * D, correct: true }], now, 0, 3);
    expect(out.map((d) => [d.right, d.missed])).toEqual([[0, 0], [0, 1], [1, 0]]);
  });
  test("uses the time zone: 11pm in Los Angeles is still that day there", () => {
    const lateLA = Date.UTC(2026, 10, 25, 7); // 23:00 on the 24th in UTC-8
    const out = activityByDay([{ at: lateLA, correct: true }], lateLA, 480, 2);
    expect(out[1].right).toBe(1);
    expect(new Date(out[1].day).toISOString().slice(0, 10)).toBe("2026-11-24");
  });
});
