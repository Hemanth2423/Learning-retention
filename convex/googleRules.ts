type Notebook = {
  title: string;
  chapters: {
    heading: string;
    note: string;
    highlights: { quote: string; comment: string; page: number }[];
  }[];
};

type NamedStyle = "TITLE" | "HEADING_2";

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
export function googleDocumentBody(notebook: Notebook): GoogleDocumentBody {
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

  paragraph(notebook.title, "TITLE");
  text += "\n";

  for (const chapter of notebook.chapters) {
    paragraph(chapter.heading, "HEADING_2");
    if (chapter.note.trim()) {
      paragraph(chapter.note);
      text += "\n";
    }
    for (const highlight of chapter.highlights) {
      paragraph(`“${highlight.quote.trim()}”`);
      if (highlight.comment.trim()) paragraph(`Comment: ${highlight.comment.trim()}`);
      paragraph(`Page ${highlight.page}`);
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
