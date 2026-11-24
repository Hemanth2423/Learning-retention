import { describe, expect, it } from "vitest";
import { googleBatchUpdate, googleDocumentBody } from "./googleRules";

describe("Google Docs export rules", () => {
  it("keeps chapter order, comments and HTML-like note text in the exported document", () => {
    const body = googleDocumentBody({
      title: "A book",
      chapters: [
        {
          heading: "Chapter 1",
          note: "",
          highlights: [{ quote: "A useful idea", comment: "Remember this", page: 3 }],
        },
        {
          heading: "Chapter 2",
          note: "<strong>This must stay text</strong>",
          highlights: [],
        },
      ],
    });

    expect(body.text).toBe(
      "A book\n\nChapter 1\n“A useful idea”\nComment: Remember this\nPage 3\n\nChapter 2\n<strong>This must stay text</strong>\n",
    );
    expect(body.text.indexOf("Chapter 1")).toBeLessThan(body.text.indexOf("Chapter 2"));
    expect(body.paragraphRanges.map(({ namedStyleType }) => namedStyleType)).toEqual(["TITLE", "HEADING_2", "HEADING_2"]);
  });

  it("replaces an existing document body before inserting the current export", () => {
    const body = googleDocumentBody({ title: "A book", chapters: [] });
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
