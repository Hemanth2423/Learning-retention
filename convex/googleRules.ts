import { type ExportBook, formatTime } from "./exportRules";

type NamedStyle = "TITLE" | "HEADING_1" | "HEADING_2";

type ParagraphRange = {
  startIndex: number;
  endIndex: number;
  namedStyleType: NamedStyle;
};

export type GoogleDocumentBody = {
  text: string;
  paragraphRanges: ParagraphRange[];
};

// Google Docs body indexes start at 1. Text is inserted as plain text, so HTML-like
// notes remain visible text instead of becoming markup.
// Reads the shared export (exportRules.buildBookExport), the same one Markdown, Print and Notion use.
export function googleDocumentBody(book: ExportBook): GoogleDocumentBody {
  let text = "";
  const paragraphRanges: ParagraphRange[] = [];

  function paragraph(value: string, namedStyleType?: NamedStyle) {
    const clean = value.trim();
    if (!clean) return;
    const startIndex = text.length + 1;
    text += `${clean}\n`;
    if (namedStyleType) {
      paragraphRanges.push({ startIndex, endIndex: text.length + 1, namedStyleType });
    }
  }

  paragraph(book.title, "TITLE");
  if (book.source) paragraph(book.source);
  text += "\n";

  const hasParts = book.sections.some(({ part }) => part);
  let lastPart: string | undefined;
  for (const section of book.sections) {
    if (hasParts && section.part && section.part !== lastPart) paragraph(section.part, "HEADING_1");
    if (hasParts && section.part) lastPart = section.part;
    paragraph(section.title, "HEADING_2");
    for (const note of section.notes) {
      paragraph(note.seconds === undefined ? note.text : `[${formatTime(note.seconds)}] ${note.text}`);
      text += "\n";
    }
    for (const highlight of section.highlights) {
      paragraph(`“${highlight.text.trim()}”`);
      if (highlight.comment?.trim()) paragraph(`Comment: ${highlight.comment.trim()}`);
      paragraph(highlight.where);
      text += "\n";
    }
    for (const q of section.saved) {
      paragraph(`Q: ${q.question}`);
      paragraph(`Your answer: ${q.yourAnswer}`);
      paragraph(`Right answer: ${q.rightAnswer}`);
      text += "\n";
    }
  }

  return { text: `${text.trimEnd()}\n`, paragraphRanges };
}

export function googleBatchUpdate(body: GoogleDocumentBody, currentEndIndex = 1) {
  const requests: Record<string, unknown>[] = [];
  if (currentEndIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: currentEndIndex - 1 } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: body.text } });
  for (const { startIndex, endIndex, namedStyleType } of body.paragraphRanges) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex, endIndex },
        paragraphStyle: { namedStyleType },
        fields: "namedStyleType",
      },
    });
  }
  return { requests };
}
