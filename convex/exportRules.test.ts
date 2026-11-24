import { expect, it } from "vitest";
import { buildNotebookExport } from "./exportRules";

it("exports notes and highlights in book order and skips empty chapters", () => {
  const notebook = buildNotebookExport({
    title: "A book",
    sections: [],
    pageCount: 60,
    reflections: [
      { sectionKey: "part-3", plainText: "My last note" },
      { sectionKey: "part-1", plainText: "My first note" },
    ],
    highlights: [{ locator: { page: 20 }, text: "A passage", comment: "Worth revisiting" }],
  });

  expect(notebook).toEqual({
    title: "A book",
    chapters: [
      {
        heading: "Part 1 · pages 1–20",
        note: "My first note",
        highlights: [{ quote: "A passage", comment: "Worth revisiting", page: 20 }],
      },
      { heading: "Part 3 · pages 41–60", note: "My last note", highlights: [] },
    ],
  });
});
