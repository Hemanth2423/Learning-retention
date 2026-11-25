import { describe, expect, it } from "vitest";
import { googleBatchUpdate, googleDocumentBody } from "./googleRules";

describe("Google Docs export rules", () => {
  it("keeps chapter order, comments and HTML-like note text in the exported document", () => {
    const body = googleDocumentBody({
      title: "A book",
      sections: [
        {
          key: "c1",
          title: "Chapter 1",
          notes: [],
          highlights: [{ text: "A useful idea", comment: "Remember this", where: "p. 3" }],
          saved: [],
        },
        {
          key: "c2",
          title: "Chapter 2",
          notes: [{ markdown: "", text: "<strong>This must stay text</strong>" }],
          highlights: [],
          saved: [],
        },
      ],
    });

    expect(body.text).toBe(
      "A book\n\nChapter 1\n“A useful idea”\nComment: Remember this\np. 3\n\nChapter 2\n<strong>This must stay text</strong>\n",
    );
    expect(body.text.indexOf("Chapter 1")).toBeLessThan(body.text.indexOf("Chapter 2"));
    expect(body.paragraphRanges.map(({ namedStyleType }) => namedStyleType)).toEqual(["TITLE", "HEADING_2", "HEADING_2"]);
  });

  it("replaces an existing document body before inserting the current export", () => {
    const body = googleDocumentBody({ title: "A book", sections: [] });
    expect(googleBatchUpdate(body, 42).requests).toEqual([
      { deleteContentRange: { range: { startIndex: 1, endIndex: 41 } } },
      { insertText: { location: { index: 1 }, text: "A book\n" } },
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: 8 },
          paragraphStyle: { namedStyleType: "TITLE" },
          fields: "namedStyleType",
        },
      },
    ]);
  });
});
