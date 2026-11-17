import { describe, expect, test } from "vitest";
import { firstPage, mergeRects, normalizeText, validateComment, validateHighlight } from "./highlightRules";

const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.02 };
const ok = { text: "Habits form with repetition", segments: [{ page: 3, rects: [rect] }], pageCount: 10 };

describe("validateHighlight", () => {
  test("accepts a normal highlight, including one that crosses a page break", () => {
    expect(validateHighlight(ok)).toBeUndefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 3, rects: [rect] }, { page: 4, rects: [rect] }] })).toBeUndefined();
  });
  test("rejects empty text, huge text, bad pages and bad boxes", () => {
    expect(validateHighlight({ ...ok, text: "  \n " })).toMatch(/Select some text/);
    expect(validateHighlight({ ...ok, text: "x".repeat(5001) })).toMatch(/too long/);
    expect(validateHighlight({ ...ok, segments: [] })).toBeDefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 11, rects: [rect] }] })).toBeDefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 1.5, rects: [rect] }] })).toBeDefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 3, rects: [] }] })).toBeDefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 3, rects: [{ ...rect, x: 2 }] }] })).toBeDefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 3, rects: [{ ...rect, w: 0 }] }] })).toBeDefined();
    expect(validateHighlight({ ...ok, segments: [{ page: 3, rects: [{ ...rect, y: NaN }] }] })).toBeDefined();
  });
});

describe("comments and text", () => {
  test("comments are limited to 2,000 characters", () => {
    expect(validateComment("fine")).toBeUndefined();
    expect(validateComment("x".repeat(2001))).toMatch(/under 2,000/);
  });
  test("text is tidied to single spaces", () => expect(normalizeText("  a\n b\t c ")).toBe("a b c"));
});

describe("firstPage", () => {
  test("is the lowest page, whatever the order", () => {
    expect(firstPage([{ page: 5, rects: [] }, { page: 4, rects: [] }])).toBe(4);
  });
});

describe("mergeRects", () => {
  test("joins boxes on the same line and keeps separate lines apart", () => {
    const a = { x: 0.1, y: 0.2, w: 0.1, h: 0.02 };
    const b = { x: 0.2, y: 0.2005, w: 0.15, h: 0.02 }; // same line, touching
    const c = { x: 0.1, y: 0.25, w: 0.3, h: 0.02 }; // next line
    const merged = mergeRects([c, b, a]);
    expect(merged).toHaveLength(2);
    expect(merged[0].x).toBeCloseTo(0.1);
    expect(merged[0].w).toBeCloseTo(0.25);
    expect(merged[1]).toEqual(c);
  });
  test("does not join boxes far apart on the same line (e.g. two columns)", () => {
    const left = { x: 0.1, y: 0.2, w: 0.1, h: 0.02 };
    const right = { x: 0.6, y: 0.2, w: 0.1, h: 0.02 };
    expect(mergeRects([left, right])).toHaveLength(2);
  });
});
