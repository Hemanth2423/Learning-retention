import { describe, expect, test } from "vitest";
import { documentTitle, hasReadableText, MAX_UPLOAD_BYTES, validateUpload } from "./documentRules";

describe("validateUpload", () => {
  const pdf = { name: "book.pdf", type: "application/pdf", size: 1000 };
  test("accepts a PDF up to 25 MB", () => {
    expect(validateUpload(pdf)).toBeUndefined();
    expect(validateUpload({ ...pdf, size: MAX_UPLOAD_BYTES })).toBeUndefined();
  });
  test("rejects a file over 25 MB, a non-PDF and an empty file", () => {
    expect(validateUpload({ ...pdf, size: MAX_UPLOAD_BYTES + 1 })).toMatch(/over 25 MB/);
    expect(validateUpload({ name: "a.docx", type: "application/msword", size: 10 })).toMatch(/isn't a PDF/);
    expect(validateUpload({ ...pdf, size: 0 })).toMatch(/Choose a PDF/);
    expect(validateUpload(null)).toMatch(/Choose a PDF/);
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
