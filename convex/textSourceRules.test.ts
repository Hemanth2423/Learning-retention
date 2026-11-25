import { describe, expect, test } from "vitest";
import { kindOfFile, slideOrder, slideText, splitBlocks, unsupportedReason, validateBlocks, validateSections } from "./textSourceRules";

describe("file kinds", () => {
  test("PDF, EPUB, Word and PowerPoint by extension, any case", () => {
    expect(["a.pdf", "b.EPUB", "c.docx", "d.pptx", "e.doc", "f.txt"].map(kindOfFile)).toEqual(["pdf", "epub", "word", "powerpoint", null, null]);
  });
  test("old Office and Kindle files say what to do instead", () => {
    expect(unsupportedReason("notes.doc")).toMatch(/Save it as \.docx/);
    expect(unsupportedReason("deck.ppt")).toMatch(/\.pptx/);
    expect(unsupportedReason("book.mobi")).toMatch(/EPUB or PDF/);
    expect(unsupportedReason("photo.jpg")).toMatch(/isn't supported/);
    expect(unsupportedReason("book.epub")).toBeUndefined();
  });
});

describe("splitBlocks", () => {
  test("keeps paragraphs whole and groups them up to the limit", () => {
    expect(splitBlocks(["aaaa", "bbbb", "cccc"], 10)).toEqual(["aaaa\n\nbbbb", "cccc"]);
    expect(splitBlocks(["", "  ", "x"], 10)).toEqual(["x"]);
  });
  test("cuts a paragraph that's too long at sentence ends", () => {
    const blocks = splitBlocks(["One two. Three four. Five six."], 20);
    expect(blocks).toEqual(["One two. Three four.", "Five six."]);
    expect(blocks.every((b) => b.length <= 20)).toBe(true);
  });
});

describe("server checks", () => {
  test("blocks must arrive in order, be non-empty and not too long", () => {
    expect(validateBlocks(["a"], 0, 0)).toBeUndefined();
    expect(validateBlocks(["a"], 5, 0)).toMatch(/out of order/);
    expect(validateBlocks([" "], 0, 0)).toMatch(/couldn't be saved/);
    expect(validateBlocks(["x".repeat(5000)], 0, 0)).toMatch(/couldn't be saved/);
    expect(validateBlocks(["a"], 3000, 3000)).toMatch(/too long/);
  });
  test("sections point inside the text and have unique keys", () => {
    const s = (key: string, page: number) => ({ key, title: "T", level: 1, locator: { kind: "text" as const, page } });
    expect(validateSections([s("a", 1), s("b", 9)], 9)).toBeUndefined();
    expect(validateSections([s("a", 10)], 9)).toMatch(/couldn't be read/);
    expect(validateSections([s("a", 1), s("a", 2)], 9)).toMatch(/couldn't be read/);
  });
});

describe("PowerPoint slides", () => {
  const slide = `<p:sld><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Q3 &amp; Q4</a:t></a:r><a:r><a:t> plan</a:t></a:r></a:p></p:txBody></p:sp>
    <p:sp><p:txBody><a:p><a:r><a:t>Grow revenue</a:t></a:r></a:p><a:p></a:p><a:p><a:r><a:t>Hire 2 engineers</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld></p:sld>`;
  test("reads the title placeholder and the other lines in order", () => {
    expect(slideText(slide)).toEqual({ title: "Q3 & Q4 plan", lines: ["Grow revenue", "Hire 2 engineers"] });
  });
  test("with no title placeholder, the first line is the title", () => {
    expect(slideText(`<p:sp><p:txBody><a:p><a:r><a:t>Hello</a:t></a:r></a:p><a:p><a:r><a:t>World</a:t></a:r></a:p></p:txBody></p:sp>`)).toEqual({ title: "Hello", lines: ["World"] });
  });
  test("slide order follows presentation.xml, not file names", () => {
    const pres = `<p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst>`;
    const rels = `<Relationships><Relationship Id="rId2" Target="slides/slide1.xml"/><Relationship Id="rId3" Target="slides/slide2.xml"/><Relationship Id="rId9" Target="theme/theme1.xml"/></Relationships>`;
    expect(slideOrder(pres, rels)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]);
  });
});
