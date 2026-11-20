import { describe, expect, test } from "vitest";
import { buildExport, exportFileName, ExportNote, noteToMarkdown, toMarkdown, toPrintHtml } from "./exportRules";

const doc = (...content: object[]) => JSON.stringify({ type: "doc", content });
const p = (text: string, marks: string[] = []) => ({ type: "paragraph", content: [{ type: "text", text, marks: marks.map((type) => ({ type })) }] });
const note = (sectionKey: string | null, text: string, createdAt = 1, seconds?: number): ExportNote => ({ sectionKey, content: doc(p(text)), plainText: text, createdAt, seconds });

const sections = [
  { key: "p1", title: "Part I. Foundations", level: 1, locator: { kind: "pdf" as const, page: 1 } },
  { key: "c1", title: "Chapter 1", level: 2, locator: { kind: "pdf" as const, page: 2 } },
  { key: "c2", title: "Chapter 2", level: 2, locator: { kind: "pdf" as const, page: 10 } },
  { key: "p2", title: "Part II. Practice", level: 1, locator: { kind: "pdf" as const, page: 20 } },
  { key: "c3", title: "Chapter 3", level: 2, locator: { kind: "pdf" as const, page: 21 } },
];
const ranges = [
  { key: "c1", title: "Chapter 1", startPage: 2, endPage: 9 },
  { key: "c2", title: "Chapter 2", startPage: 10, endPage: 20 },
  { key: "c3", title: "Chapter 3", startPage: 21, endPage: 30 },
];

describe("buildExport", () => {
  // TEAM-PLAN.md, @EEBarr14's card: chapter order, highlight + comment under its chapter, HTML in a note shown as text.
  test("Chapter 1 comes before Chapter 2, the highlight and comment sit under Chapter 1, and HTML in a note is text", () => {
    const book = buildExport({
      title: "Habits",
      ranges,
      sections,
      notes: [note("c2", "<b>loud</b> idea")],
      highlights: [{ page: 4, text: "Cues start loops", comment: "Key idea", order: 4 }],
      saved: [],
    });
    expect(book.sections.map((s) => s.key)).toEqual(["c1", "c2"]);
    expect(book.sections[0].highlights).toEqual([{ text: "Cues start loops", comment: "Key idea", where: "p. 4" }]);
    const md = toMarkdown(book);
    expect(md.indexOf("Chapter 1")).toBeLessThan(md.indexOf("Chapter 2"));
    expect(md).toContain("\\<b\\>loud\\</b\\> idea");
    expect(toPrintHtml(book)).toContain("&lt;b&gt;loud&lt;/b&gt; idea");
    expect(toPrintHtml(book)).not.toContain("<b>loud</b>");
  });

  test("General notes first; empty chapters left out; parts become headings", () => {
    const book = buildExport({ title: "T", ranges, sections, notes: [note("c2", "two"), note(null, "overall")], highlights: [], saved: [] });
    expect(book.sections.map((s) => s.key)).toEqual(["general", "c2"]);
    expect(book.sections[1].part).toBe("Part I. Foundations");
    const md = toMarkdown(book);
    expect(md).toContain("## General notes\n\noverall\n\n## Part I. Foundations\n\n### Chapter 2\n\ntwo");
  });

  test("choosing what to include leaves the rest out", () => {
    const input = {
      title: "T",
      ranges,
      sections,
      notes: [note("c1", "a note")],
      highlights: [{ page: 3, text: "a highlight", order: 3 }],
      saved: [{ chapterKey: "c1", question: "Q?", yourAnswer: "x", rightAnswer: "y", createdAt: 1 }],
    };
    const onlySaved = toMarkdown(buildExport({ ...input, options: { notes: false, highlights: false, saved: true } }));
    expect(onlySaved).toContain("**Q: Q?**\n- Your answer: ~~x~~\n- Right answer: **y**");
    expect(onlySaved).not.toContain("a note");
    expect(onlySaved).not.toContain("a highlight");
    expect(buildExport({ ...input, options: { notes: false, highlights: false, saved: false } }).sections).toEqual([]);
  });

  test("video notes are in time order with their time; articles cite §", () => {
    const vid = buildExport({
      title: "Talk",
      ranges: [{ key: "video", title: "Talk", startPage: 1, endPage: 1 }],
      sections: [],
      notes: [note("video", "later", 1, 300), note("video", "earlier", 2, 65)],
      highlights: [],
      saved: [],
    });
    expect(toMarkdown(vid)).toMatch(/\*\*\[1:05\]\*\* earlier\n\n\*\*\[5:00\]\*\* later/);
    const art = buildExport({ title: "Essay", ranges: [{ key: "article", title: "Essay", startPage: 1, endPage: 9 }], sections: [], notes: [], highlights: [{ page: 3, text: "x", order: 0 }], saved: [], pageLabel: "§" });
    expect(art.sections[0].highlights[0].where).toBe("§3");
  });
});

describe("noteToMarkdown", () => {
  test("keeps bold, italic, headings and lists", () => {
    const content = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Big idea" }] },
      p("strong", ["bold"]),
      { type: "bulletList", content: [{ type: "listItem", content: [p("one")] }, { type: "listItem", content: [p("two", ["italic"])] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [p("first")] }] }
    );
    expect(noteToMarkdown(content, "")).toBe("### Big idea\n\n**strong**\n\n- one\n- *two*\n\n1. first");
  });
  test("falls back to the plain copy when the content isn't editor JSON", () => {
    expect(noteToMarkdown("not json", "plain *text*")).toBe("plain \\*text\\*");
  });
});

test("exportFileName drops characters file systems reject", () => {
  expect(exportFileName('A/B: "C"?')).toBe("A B C.md");
  expect(exportFileName("  ")).toBe("Notes.md");
});
