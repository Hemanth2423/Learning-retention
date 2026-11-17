// @vitest-environment node
import { describe, expect, test } from "vitest";
import { readPdf } from "./pdf";

// Builds a tiny real PDF: text pages (empty string = image-only page) and an outline of {title, page, level 1|2}.
function makePdf(pages: string[], outline: { title: string; page: number; level: 1 | 2 }[] = []): Uint8Array {
  const n = pages.length;
  const pageObj = (i: number) => 5 + i;
  const contentObj = (i: number) => 5 + n + i;
  const firstOutline = 5 + 2 * n;
  const top = outline.map((o, i) => ({ ...o, i })).filter((o) => o.level === 1);
  const parentOf = (i: number) => [...top].reverse().find((t) => t.i < i)!.i;
  const children = (p: number) => outline.map((o, i) => ({ ...o, i })).filter((o) => o.level === 2 && parentOf(o.i) === p);

  const objs: Record<number, string> = {};
  objs[1] = `<< /Type /Catalog /Pages 3 0 R${outline.length ? " /Outlines 2 0 R" : ""} >>`;
  objs[2] = outline.length
    ? `<< /Type /Outlines /First ${firstOutline + top[0].i} 0 R /Last ${firstOutline + top[top.length - 1].i} 0 R /Count ${top.length} >>`
    : `<< /Type /Outlines /Count 0 >>`;
  objs[3] = `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>`;
  objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  pages.forEach((text, i) => {
    objs[pageObj(i)] = `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents ${contentObj(i)} 0 R /Resources << /Font << /F1 4 0 R >> >> >>`;
    const stream = text ? `BT /F1 12 Tf 72 700 Td (${text}) Tj ET` : "";
    objs[contentObj(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  outline.forEach((o, i) => {
    const id = firstOutline + i;
    const kids = o.level === 1 ? children(i) : [];
    const siblings = outline.map((x, j) => ({ ...x, j })).filter((x) => x.level === o.level && (o.level === 1 || parentOf(x.j) === parentOf(i)));
    const idx = siblings.findIndex((s) => s.j === i);
    objs[id] =
      `<< /Title (${o.title}) /Parent ${o.level === 1 ? 2 : firstOutline + parentOf(i)} 0 R` +
      (idx > 0 ? ` /Prev ${firstOutline + siblings[idx - 1].j} 0 R` : "") +
      (idx < siblings.length - 1 ? ` /Next ${firstOutline + siblings[idx + 1].j} 0 R` : "") +
      (kids.length ? ` /First ${firstOutline + kids[0].i} 0 R /Last ${firstOutline + kids[kids.length - 1].i} 0 R /Count ${kids.length}` : "") +
      ` /Dest [${pageObj(o.page - 1)} 0 R /Fit] >>`;
  });

  const ids = Object.keys(objs).map(Number).sort((a, b) => a - b);
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const id of ids) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objs[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${ids.length + 1}\n0000000000 65535 f \n`;
  for (const id of ids) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${ids.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

describe("readPdf", () => {
  test("returns text per page and the contents with exact page numbers", async () => {
    const bytes = makePdf(["Alpha page text", "Beta page text", "Gamma page text", "Delta page text"], [
      { title: "Part One", page: 1, level: 1 },
      { title: "Chapter 1", page: 2, level: 2 },
      { title: "Part Two", page: 3, level: 1 },
    ]);
    const r = await readPdf(bytes);
    expect(r.pages).toHaveLength(4);
    expect(r.pages[1]).toContain("Beta page text");
    expect(r.sections.map((s) => [s.title, s.level, s.page])).toEqual([
      ["Part One", 1, 1],
      ["Chapter 1", 2, 2],
      ["Part Two", 1, 3],
    ]);
  });

  test("a PDF with no contents gives no sections", async () => {
    const r = await readPdf(makePdf(["Only page"]));
    expect(r.sections).toEqual([]);
  });

  test("an image-only page comes back as empty text", async () => {
    const r = await readPdf(makePdf(["", ""]));
    expect(r.pages).toEqual(["", ""]);
  });
});
