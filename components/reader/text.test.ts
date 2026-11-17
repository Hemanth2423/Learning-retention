import { describe, expect, test } from "vitest";
import { readableTitle } from "./text";

describe("readableTitle", () => {
  test("turns an all-caps chapter title into title case", () => {
    expect(readableTitle("CHAPTER 10: DESIGN A NOTIFICATION SYSTEM")).toBe("Chapter 10: Design a Notification System");
    expect(readableTitle("THE ART OF WAR")).toBe("The Art of War");
  });
  test("leaves normal titles and short labels alone", () => {
    expect(readableTitle("Chapter 2: Remembering What You Learn")).toBe("Chapter 2: Remembering What You Learn");
    expect(readableTitle("AI")).toBe("AI");
    expect(readableTitle("Using LLMs in practice")).toBe("Using LLMs in practice");
  });
});

import { splitChapterTitle } from "./text";

describe("splitChapterTitle", () => {
  test("pulls the chapter number out of the title", () => {
    expect(splitChapterTitle("Chapter 8: Design a URL Shortener")).toEqual({ number: "8", title: "Design a URL Shortener" });
    expect(splitChapterTitle("CHAPTER 10 - DESIGN A NOTIFICATION SYSTEM")).toEqual({ number: "10", title: "Design a Notification System" });
    expect(splitChapterTitle("Ch. 3 Applying What You Know")).toEqual({ number: "3", title: "Applying What You Know" });
  });
  test("leaves other titles alone", () => {
    expect(splitChapterTitle("Basics of scale")).toEqual({ number: null, title: "Basics of scale" });
    expect(splitChapterTitle("Part 1 · pages 1–20")).toEqual({ number: null, title: "Part 1 · pages 1–20" });
  });
});

import { chapterBadge } from "./text";

describe("chapter numbers come from the book, not the position", () => {
  test("uses the title's own number, P for parts, a dot when there is none", () => {
    expect(chapterBadge("CHAPTER 8: DESIGN A URL SHORTENER", 9, false)).toBe("8");
    expect(chapterBadge("Foreword", 0, false)).toBe("•");
    expect(chapterBadge("Part 3 · pages 41–60", 2, true)).toBe("P3");
  });
  test("acronyms stay in capitals", () => {
    expect(readableTitle("CHAPTER 8: DESIGN A URL SHORTENER")).toBe("Chapter 8: Design a URL Shortener");
    expect(readableTitle("BUILDING APIS WITH SQL")).toBe("Building APIs With SQL");
  });
});
