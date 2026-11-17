// The PDF source adapter: file bytes in, a source-agnostic shape out (pages of text + contents).
// Future formats (link, YouTube) get their own file here that returns the same shape.
import { extractText, getDocumentProxy, getMeta } from "unpdf";

export type PdfSection = { key: string; title: string; level: number; page: number };
export type PdfRead = { metaTitle?: string; pages: string[]; sections: PdfSection[] };

const MAX_SECTIONS = 2000;
const MAX_PAGE_CHARS = 20000;

type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;
type OutlineItem = { title: string; dest: unknown; items?: OutlineItem[] };

// Turns an outline destination into a 1-based page number, or null if it doesn't point at a page.
async function pageOf(pdf: Pdf, dest: unknown): Promise<number | null> {
  try {
    const resolved = typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(resolved) || resolved.length === 0) return null;
    const target = resolved[0];
    if (typeof target === "number") return target + 1;
    return (await pdf.getPageIndex(target)) + 1;
  } catch {
    return null;
  }
}

async function readOutline(pdf: Pdf): Promise<PdfSection[]> {
  const outline = (await pdf.getOutline()) as OutlineItem[] | null;
  const sections: PdfSection[] = [];
  async function walk(items: OutlineItem[], level: number) {
    for (const item of items) {
      if (sections.length >= MAX_SECTIONS) return;
      const page = await pageOf(pdf, item.dest);
      const title = (item.title ?? "").replace(/\s+/g, " ").trim();
      if (page !== null && title) sections.push({ key: `s${sections.length}`, title: title.slice(0, 200), level, page });
      if (item.items?.length) await walk(item.items, level + 1);
    }
  }
  await walk(outline ?? [], 1);
  return sections;
}

export async function readPdf(bytes: Uint8Array): Promise<PdfRead> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const meta = await getMeta(pdf).catch(() => null);
  return {
    metaTitle: typeof meta?.info?.Title === "string" ? meta.info.Title : undefined,
    pages: text.map((t) => t.replace(/[ \t]+\n/g, "\n").trim().slice(0, MAX_PAGE_CHARS)),
    sections: await readOutline(pdf),
  };
}
