import { describe, expect, test } from "vitest";
import { isEmptyNote, MAX_NOTE_JSON, MAX_NOTE_TEXT, validateNote } from "./reflectionRules";

const doc = JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] });

describe("validateNote", () => {
  test("accepts a normal note", () => expect(validateNote({ content: doc, plainText: "Hi" })).toBeUndefined());
  test("rejects too much text or a too-large note", () => {
    expect(validateNote({ content: doc, plainText: "x".repeat(MAX_NOTE_TEXT + 1) })).toMatch(/under 10,000/);
    expect(validateNote({ content: "x".repeat(MAX_NOTE_JSON + 1), plainText: "Hi" })).toMatch(/too large/);
  });
  test("rejects anything that isn't a saved editor document", () => {
    expect(validateNote({ content: "not json", plainText: "Hi" })).toBeDefined();
    expect(validateNote({ content: '{"type":"paragraph"}', plainText: "Hi" })).toBeDefined();
    expect(validateNote({ content: "null", plainText: "Hi" })).toBeDefined();
  });
});

describe("isEmptyNote", () => {
  test("blank text counts as empty", () => {
    expect(isEmptyNote("  \n ")).toBe(true);
    expect(isEmptyNote("a")).toBe(false);
    expect(isEmptyNote("", '{"type":"doc","content":[{"type":"image","attrs":{"src":"x"}}]}')).toBe(false);
  });
});

import { MAX_NOTE_IMAGE_BYTES, validateNoteImage } from "./reflectionRules";

describe("validateNoteImage", () => {
  test("accepts images up to 5 MB and nothing else", () => {
    expect(validateNoteImage({ size: 1000, contentType: "image/png" })).toBeUndefined();
    expect(validateNoteImage({ size: MAX_NOTE_IMAGE_BYTES + 1, contentType: "image/jpeg" })).toMatch(/5 MB/);
    expect(validateNoteImage({ size: 1000, contentType: "application/pdf" })).toMatch(/isn't an image/);
    expect(validateNoteImage(null)).toMatch(/didn't upload/);
  });
});
