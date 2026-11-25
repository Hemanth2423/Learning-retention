import { expect, it } from "vitest";
import { EMPTY_NOTEBOOK_TEXT, notebookBlocks, notionBlockBatches } from "./notionRules";

it("given a book with no notes or highlights, when it is sent, then the page says so instead of being blank", () => {
  const blocks = notebookBlocks({ title: "A book", chapters: [] });
  expect(blocks).toEqual([
    { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: EMPTY_NOTEBOOK_TEXT } }] } },
  ]);
});

it("preserves chapter order and puts the comment and page number below the quote", () => {
  const blocks = notebookBlocks({
    title: "A book",
    chapters: [
      { heading: "First chapter", note: "A note", highlights: [{ quote: "A quote", comment: "My comment", page: 3 }] },
      { heading: "Second chapter", note: "", highlights: [] },
    ],
  });

  expect(blocks.map((block) => block.type)).toEqual(["heading_2", "paragraph", "quote", "paragraph", "heading_2"]);
  expect(blocks[3]).toMatchObject({ paragraph: { rich_text: [{ text: { content: "My comment\np.3" } }] } });
  expect(blocks[4]).toMatchObject({ heading_2: { rich_text: [{ text: { content: "Second chapter" } }] } });
});

it("splits long text without breaking an emoji and batches at most 100 blocks", () => {
  const note = "a".repeat(1_999) + "📖".repeat(100);
  const blocks = notebookBlocks({ title: "A book", chapters: [{ heading: "Chapter", note, highlights: [] }] });
  const chunks = blocks.flatMap((block) => block.type === "paragraph" ? block.paragraph.rich_text.map(({ text }) => text.content) : []);
  expect(chunks).toHaveLength(2);
  expect(chunks.every((chunk) => chunk.length <= 2_000)).toBe(true);
  expect(chunks.join("")).toBe(note);
  expect(notionBlockBatches(Array(101).fill(blocks[0])).map((batch) => batch.length)).toEqual([100, 1]);
});
