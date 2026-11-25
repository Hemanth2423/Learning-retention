import { readableTitle } from "../components/reader/text";
import { chapterRanges, type SectionLike } from "./chapters";

type NotebookInput = {
  title: string;
  sections: (SectionLike & { title: string })[];
  pageCount: number;
  reflections: { sectionKey: string; plainText?: string }[];
  highlights: { locator: { page: number }; text: string; comment?: string }[];
};

export function buildNotebookExport({
  title,
  sections,
  pageCount,
  reflections,
  highlights,
}: NotebookInput) {
  const notesByChapter = new Map(
    reflections.map(({ sectionKey, plainText }) => [sectionKey, plainText?.trim() ?? ""]),
  );
  const chapters = chapterRanges(sections, pageCount).flatMap((chapter) => {
    const note = notesByChapter.get(chapter.key) ?? "";
    const chapterHighlights = highlights
      .filter(({ locator }) => locator.page >= chapter.startPage && locator.page <= chapter.endPage)
      .map(({ locator, text, comment }) => ({
        quote: text,
        comment: comment ?? "",
        page: locator.page,
      }));

    if (!note && chapterHighlights.length === 0) return [];
    return [{ heading: readableTitle(chapter.title), note, highlights: chapterHighlights }];
  });

  return { title, chapters };
}
