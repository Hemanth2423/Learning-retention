import { describe, expect, test } from "vitest";
import { chapterParts, formatTime, notebookGroups, NotebookItem, partOf, validateSeconds } from "./notebookRules";

const sections = [
  { key: "p1", title: "Part I. Foundations", level: 1, locator: { kind: "pdf" as const, page: 1 } },
  { key: "c1", title: "Chapter 1", level: 2, locator: { kind: "pdf" as const, page: 2 } },
  { key: "c2", title: "Chapter 2", level: 2, locator: { kind: "pdf" as const, page: 10 } },
  { key: "p2", title: "Part II. Practice", level: 1, locator: { kind: "pdf" as const, page: 20 } },
  { key: "c3", title: "Chapter 3", level: 2, locator: { kind: "pdf" as const, page: 21 } },
];
const ranges = [
  { key: "c1", title: "Chapter 1", startPage: 2, endPage: 9 },
  { key: "c2", title: "Chapter 2", startPage: 10, endPage: 19 },
  { key: "c3", title: "Chapter 3", startPage: 21, endPage: 30 },
];
const items: NotebookItem[] = [
  { kind: "note", id: "n3", chapterKey: "c3", text: "Practice beats theory", order: 3 },
  { kind: "highlight", id: "h1", chapterKey: "c1", text: "habits form loops", comment: "cue routine reward", order: 5 },
  { kind: "note", id: "g1", chapterKey: null, text: "Overall: a useful book", order: 1 },
  { kind: "saved", id: "s1", chapterKey: "c1", text: "What starts a habit?", order: 9 },
  { kind: "note", id: "n1", chapterKey: "c1", text: "Loops need a reward", order: 2 },
];

describe("notebookGroups (whole book)", () => {
  test("General notes come first, then chapters in book order with their Part", () => {
    const groups = notebookGroups(items, ranges, sections, "all");
    expect(groups.map((g) => g.key)).toEqual(["general", "c1", "c3"]); // Chapter 2 has nothing, so it's hidden
    expect(groups[1].part).toBe("Part I. Foundations");
    expect(groups[2].part).toBe("Part II. Practice");
  });

  test("inside a chapter: highlights first, then notes, then saved questions", () => {
    const c1 = notebookGroups(items, ranges, sections, "all").find((g) => g.key === "c1")!;
    expect(c1.items.map((i) => i.id)).toEqual(["h1", "n1", "s1"]);
  });

  test("General notes show only under All and Notes", () => {
    expect(notebookGroups(items, ranges, sections, "notes").map((g) => g.key)).toEqual(["general", "c1", "c3"]);
    expect(notebookGroups(items, ranges, sections, "highlights").map((g) => g.key)).toEqual(["c1"]);
    expect(notebookGroups(items, ranges, sections, "saved").map((g) => g.key)).toEqual(["c1"]);
  });

  test("search matches text and highlight comments, and hides empty groups", () => {
    expect(notebookGroups(items, ranges, sections, "all", "REWARD").flatMap((g) => g.items.map((i) => i.id))).toEqual(["h1", "n1"]);
    expect(notebookGroups(items, ranges, sections, "all", "nothing like this")).toEqual([]);
  });

  test("a note whose chapter no longer exists stays visible under General notes", () => {
    const orphan: NotebookItem = { kind: "note", id: "x", chapterKey: "gone", text: "kept", order: 0 };
    expect(notebookGroups([orphan], ranges, sections, "all")[0]).toMatchObject({ key: "general", items: [orphan] });
  });
});

describe("partOf", () => {
  test("finds the enclosing Part, or nothing for books without parts", () => {
    expect(partOf(sections, "c2")).toBe("Part I. Foundations");
    expect(partOf(sections, "p1")).toBeUndefined();
    expect(partOf([{ key: "a", title: "A", level: 1, locator: { kind: "pdf", page: 1 } }], "a")).toBeUndefined();
  });
});

describe("chapterParts", () => {
  test("two or more Parts are kept; a single top-level title entry is not a Part", () => {
    expect([...chapterParts(sections, ["c1", "c2", "c3"]).values()]).toEqual(["Part I. Foundations", "Part I. Foundations", "Part II. Practice"]);
    const titled = [
      { key: "t", title: "Designing Data-Intensive Applications", level: 1, locator: { kind: "pdf" as const, page: 1 } },
      { key: "a", title: "Chapter 1", level: 2, locator: { kind: "pdf" as const, page: 2 } },
      { key: "b", title: "Chapter 2", level: 2, locator: { kind: "pdf" as const, page: 9 } },
    ];
    expect(chapterParts(titled, ["a", "b"]).size).toBe(0);
  });
});

describe("video times", () => {
  test("formatTime", () => {
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(725.9)).toBe("12:05");
    expect(formatTime(3723)).toBe("1:02:03");
  });
  test("validateSeconds", () => {
    expect(validateSeconds(undefined)).toBeUndefined();
    expect(validateSeconds(42)).toBeUndefined();
    expect(validateSeconds(-1)).toMatch(/isn't in the video/);
    expect(validateSeconds(Number.NaN)).toMatch(/isn't in the video/);
  });
});
