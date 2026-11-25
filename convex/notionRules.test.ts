import { expect, it } from "vitest";
import type { ExportSection } from "./exportRules";
import { EMPTY_NOTEBOOK_TEXT, notebookBlocks, notionBlockBatches } from "./notionRules";

const section = (key: string, title: string, extra: Partial<ExportSection> = {}): ExportSection => ({
  key, title, notes: [], highlights: [], saved: [], ...extra,
});
const contents = (block: ReturnType<typeof notebookBlocks>[number]) =>
  (block as unknown as Record<string, { rich_text: { text: { content: string } }[] }>)[block.type].rich_text[0].text.content;

it("given a book with no notes or highlights, when it is sent, then the page says so instead of being blank", () => {
  const blocks = notebookBlocks({ title: "A book", sections: [] });
  expect(blocks).toEqual([
    { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: EMPTY_NOTEBOOK_TEXT } }] } },
  ]);
});

it("preserves chapter order and puts the comment and page number below the quote", () => {
  const blocks = notebookBlocks({
    title: "A book",
    sections: [
      section("a", "First chapter", {
        notes: [{ markdown: "A \\*note", text: "A *note" }],
        highlights: [{ text: "A quote", comment: "My comment", where: "p. 3" }],
      }),
      section("b", "Second chapter"),
    ],
  });

  expect(blocks.map((block) => block.type)).toEqual(["heading_2", "paragraph", "quote", "paragraph", "heading_2"]);
  expect(contents(blocks[1])).toBe("A *note");
  expect(contents(blocks[3])).toBe("My comment\np. 3");
  expect(contents(blocks[4])).toBe("Second chapter");
});

it("sends the source, parts, video times and saved questions", () => {
  const blocks = notebookBlocks({
    title: "A talk",
    source: "Video · A channel",
    sections: [section("a", "Chapter", {
      part: "Part I",
      notes: [{ markdown: "Later", text: "Later", seconds: 65 }],
      saved: [{ chapterKey: "a", question: "Why?", yourAnswer: "No", rightAnswer: "Yes", createdAt: 1 }],
    })],
  });

  expect(blocks.map((block) => block.type)).toEqual(["paragraph", "heading_2", "heading_3", "paragraph", "paragraph"]);
  expect(blocks.map(contents)).toEqual([
    "Video · A channel", "Part I", "Chapter", "[1:05] Later", "Q: Why?\nYour answer: No\nRight answer: Yes",
  ]);
});

it("splits long text without breaking an emoji and batches at most 100 blocks", () => {
  const note = "a".repeat(1_999) + "📖".repeat(100);
  const blocks = notebookBlocks({ title: "A book", sections: [section("a", "Chapter", { notes: [{ markdown: note, text: note }] })] });
  const chunks = blocks.flatMap((block) => block.type === "paragraph" ? block.paragraph.rich_text.map(({ text }) => text.content) : []);
  expect(chunks).toHaveLength(2);
  expect(chunks.every((chunk) => chunk.length <= 2_000)).toBe(true);
  expect(chunks.join("")).toBe(note);
  expect(notionBlockBatches(Array(101).fill(blocks[0])).map((batch) => batch.length)).toEqual([100, 1]);
});
