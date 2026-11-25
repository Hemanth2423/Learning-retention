import { describe, expect, test } from "vitest";
import { documentTitle, hasReadableText, MAX_UPLOAD_BYTES, validateUpload } from "./documentRules";

describe("validateUpload", () => {
  const pdf = { name: "book.pdf", type: "application/pdf", size: 1000 };
  test("accepts a PDF up to 25 MB", () => {
    expect(validateUpload(pdf)).toBeUndefined();
    expect(validateUpload({ ...pdf, size: MAX_UPLOAD_BYTES })).toBeUndefined();
  });
  test("rejects a file over 25 MB, an unsupported type and an empty file", () => {
    expect(validateUpload({ ...pdf, size: MAX_UPLOAD_BYTES + 1 })).toMatch(/PDF is over 25 MB/);
    expect(validateUpload({ name: "a.txt", type: "text/plain", size: 10 })).toMatch(/isn't supported/);
    expect(validateUpload({ name: "a.doc", type: "application/msword", size: 10 })).toMatch(/\.docx/);
    expect(validateUpload({ ...pdf, size: 0 })).toMatch(/Choose a file/);
    expect(validateUpload(null)).toMatch(/Choose a file/);
  });
  // Feature 3: EPUB, Word and PowerPoint are added the same way (they used to be refused as "not a PDF").
  test("accepts EPUB, Word (.docx) and PowerPoint (.pptx) up to 25 MB", () => {
    for (const name of ["book.epub", "notes.docx", "deck.pptx"]) expect(validateUpload({ name, type: "", size: 1000 })).toBeUndefined();
    expect(validateUpload({ name: "big.epub", type: "", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/EPUB is over 25 MB/);
  });
  test("accepts a .pdf whose type the browser left blank", () => {
    expect(validateUpload({ name: "Book.PDF", type: "", size: 10 })).toBeUndefined();
  });
});

describe("hasReadableText (scan detection)", () => {
  const page = "This page has plenty of readable words on it, well over forty characters.";
  test("a normal book has text", () => expect(hasReadableText([page, page, page])).toBe(true));
  test("image-only pages have none", () => expect(hasReadableText(["", " ", "12", ""])).toBe(false));
  test("a scan with a few text pages is still treated as a scan", () => {
    expect(hasReadableText([page, "", "", "", "", "", "", "", "", ""])).toBe(false);
  });
  test("an empty document has none", () => expect(hasReadableText([])).toBe(false));
});

describe("documentTitle", () => {
  test("prefers the PDF's own title, else the file name", () => {
    expect(documentTitle("Deep Work", "x.pdf")).toBe("Deep Work");
    expect(documentTitle(undefined, "my_book.pdf")).toBe("my book");
    expect(documentTitle("  ", "")).toBe("Untitled");
  });
});

import { libraryOrder, validateTitle } from "./documentRules";

describe("library rules", () => {
  test("titles must be 1 to 120 characters after trimming", () => {
    expect(validateTitle("  Deep Work ")).toBeUndefined();
    expect(validateTitle("   ")).toMatch(/Give the book a title/);
    expect(validateTitle("x".repeat(121))).toMatch(/under 120/);
  });
  test("the most recently read book comes first; unread books sort by when they were added", () => {
    const books = [
      { id: "old-unread", _creationTime: 100 },
      { id: "read-yesterday", _creationTime: 50, lastReadAt: 500 },
      { id: "new-unread", _creationTime: 900 },
      { id: "read-now", _creationTime: 10, lastReadAt: 1000 },
    ];
    expect(libraryOrder(books).map((b) => b.id)).toEqual(["read-now", "new-unread", "read-yesterday", "old-unread"]);
  });
});
