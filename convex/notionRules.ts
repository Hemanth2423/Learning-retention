import type { buildNotebookExport } from "./exportRules";

type Notebook = ReturnType<typeof buildNotebookExport>;
type RichText = { type: "text"; text: { content: string } };
type NotionBlock = {
  object: "block";
} & (
  | { type: "heading_2"; heading_2: { rich_text: RichText[] } }
  | { type: "paragraph"; paragraph: { rich_text: RichText[] } }
  | { type: "quote"; quote: { rich_text: RichText[] } }
);

const MAX_TEXT_LENGTH = 2_000;
const MAX_BLOCKS_PER_REQUEST = 100;
const MAX_BLOCK_BYTES = 490_000;
// Convex stops an action after 10 minutes, so a send still unfinished after that has died.
const MAX_SEND_MS = 10 * 60 * 1000;

export const PAGE_GONE = "We can’t reach that Notion page. Choose a page to send to.";

export function isAbandonedSend(startedAt: number, now: number) {
  return now - startedAt > MAX_SEND_MS;
}

function splitText(text: string): string[] {
  const parts: string[] = [];
  let part = "";

  // Iteration by code point keeps emoji intact across chunk boundaries.
  for (const character of text) {
    if (part.length + character.length > MAX_TEXT_LENGTH) {
      parts.push(part);
      part = "";
    }
    part += character;
  }
  if (part) parts.push(part);
  return parts;
}

function richText(content: string): RichText[] {
  return [{ type: "text", text: { content } }];
}

function paragraphs(text: string): NotionBlock[] {
  return text.split(/\n\s*\n/).flatMap((paragraph) =>
    splitText(paragraph).map((part) => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: richText(part) },
    })),
  );
}

export const EMPTY_NOTEBOOK_TEXT = "No notes or highlights yet. Add some in Ingrain, then send again.";

export function notebookBlocks(notebook: Notebook): NotionBlock[] {
  // A blank page looks like a failed send, so say why it's empty.
  if (notebook.chapters.length === 0) return paragraphs(EMPTY_NOTEBOOK_TEXT);
  return notebook.chapters.flatMap(({ heading, note, highlights }) => [
    ...splitText(heading).map((part): NotionBlock => ({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: richText(part) },
    })),
    ...paragraphs(note),
    ...highlights.flatMap(({ quote, comment, page }) => [
      ...splitText(quote).map((part): NotionBlock => ({
        object: "block",
        type: "quote",
        quote: { rich_text: richText(part) },
      })),
      ...paragraphs(comment ? `${comment}\np.${page}` : `p.${page}`),
    ]),
  ]);
}

export function notionBlockBatches(blocks: NotionBlock[]): NotionBlock[][] {
  const batches: NotionBlock[][] = [];
  const encoder = new TextEncoder();
  let batch: NotionBlock[] = [];
  let bytes = 0;

  for (const block of blocks) {
    const size = encoder.encode(JSON.stringify(block)).length + 1;
    if (batch.length === MAX_BLOCKS_PER_REQUEST || bytes + size > MAX_BLOCK_BYTES) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(block);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
