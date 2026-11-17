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
