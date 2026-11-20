// Reads EPUB, Word (.docx) and PowerPoint (.pptx) files in the browser into text blocks + contents.
// No AI, nothing sent anywhere until the result is saved. HTML is never kept: it's turned into plain Markdown text
// (no scripts, styles or raw HTML survive), which the reader renders safely.
import { escapeMarkdown } from "@/convex/exportRules";
import { MAX_BLOCK_CHARS } from "@/convex/linkRules";
import { slideOrder, slideText, splitBlocks, TextKind, TextSection } from "@/convex/textSourceRules";

export type ReadResult = { title: string; blocks: string[]; sections: TextSection[]; cover: Blob | null; note?: string };

// A paragraph of Markdown plus the anchors (file / file#id) that point at it. `breakBefore`: start a new block,
// so a chapter always begins at the top of a block (the Contents jump there exactly).
type Unit = { md: string; anchors: string[]; breakBefore: boolean };

export class ReadError extends Error {}

// ---- HTML → Markdown paragraphs ----

const BLOCK_TAGS = new Set(["p", "div", "section", "article", "blockquote", "li", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "table", "tr", "ul", "ol", "figure", "figcaption", "header", "footer", "aside", "nav", "main", "dl", "dt", "dd", "hr", "body"]);
const SKIP_TAGS = new Set(["script", "style", "head", "img", "svg", "math", "video", "audio", "iframe", "object", "noscript", "template", "button", "input", "select", "textarea"]);

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdown((node.textContent ?? "").replace(/\s+/g, " "));
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  const tag = el.localName.toLowerCase();
  if (SKIP_TAGS.has(tag)) return "";
  if (tag === "br") return "  \n";
  const inner = Array.from(el.childNodes).map(inlineText).join("");
  if (!inner.trim()) return inner;
  // Keep the spaces outside the markers, or Markdown won't see them as bold / italic.
  const wrap = (m: string) => `${/^\s/.test(inner) ? " " : ""}${m}${inner.trim()}${m}${/\s$/.test(inner) ? " " : ""}`;
  if (tag === "strong" || tag === "b") return wrap("**");
  if (tag === "em" || tag === "i" || tag === "cite") return wrap("*");
  if (tag === "code") return `\`${inner.trim()}\``;
  if (tag === "sup" && /^\s*\[?\d+\]?\s*$/.test(el.textContent ?? "")) return ""; // footnote markers
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return /^https?:\/\//.test(href) ? `[${inner.trim()}](${href})` : inner;
  }
  return inner;
}

// Walks an element and appends paragraphs. `ids` collects element ids seen since the last paragraph, so links
// to "#id" land on the paragraph that follows them.
function walk(el: Element, file: string, units: Unit[], pending: { anchors: string[]; breakBefore: boolean }, breakLevel: number) {
  const flush = (md: string, extraBreak = false) => {
    const text = md.replace(/[ \t]+\n/g, "\n").trim();
    if (!text) return;
    units.push({ md: text, anchors: pending.anchors.splice(0), breakBefore: pending.breakBefore || extraBreak });
    pending.breakBefore = false;
  };
  let inline = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const child = node as Element;
      const tag = child.localName.toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      const id = child.getAttribute("id");
      if (BLOCK_TAGS.has(tag)) {
        flush(inline);
        inline = "";
        if (id) pending.anchors.push(`${file}#${id}`);
        const h = tag.match(/^h([1-6])$/);
        if (h) flush(`${"#".repeat(Math.min(6, Number(h[1]) + 1))} ${inlineText(child).trim()}`, Number(h[1]) <= breakLevel);
        else if (tag === "li") flush(`- ${inlineText(child).trim()}`);
        else if (tag === "blockquote") flush(`> ${inlineText(child).trim()}`);
        else if (tag === "pre") flush("```\n" + (child.textContent ?? "").trimEnd() + "\n```");
        else if (tag === "tr") flush(Array.from(child.children).map((c) => inlineText(c).trim()).join(" | "));
        else if (tag === "hr") continue;
        else if (tag === "p" || tag === "dt" || tag === "dd" || tag === "figcaption") flush(inlineText(child));
        else walk(child, file, units, pending, breakLevel);
      } else {
        if (id) pending.anchors.push(`${file}#${id}`);
        inline += inlineText(child);
      }
    } else if (node.nodeType === Node.TEXT_NODE) inline += inlineText(node);
  }
  flush(inline);
}

function htmlUnits(doc: Document, file: string, breakLevel: number): Unit[] {
  const units: Unit[] = [];
  const pending = { anchors: [file], breakBefore: true };
  if (doc.body) walk(doc.body, file, units, pending, breakLevel);
  return units;
}

// Paragraphs → blocks of ≤ MAX_BLOCK_CHARS, honouring breaks; returns where each anchor landed (1-based block).
function toBlocks(units: Unit[]): { blocks: string[]; anchorBlock: Map<string, number> } {
  const blocks: string[] = [];
  const anchorBlock = new Map<string, number>();
  let cur: string[] = [];
  const push = () => {
    if (cur.length) blocks.push(...splitBlocks(cur));
    cur = [];
  };
  for (const u of units) {
    const size = cur.join("\n\n").length;
    if (u.breakBefore || (cur.length && size + u.md.length + 2 > MAX_BLOCK_CHARS)) push();
    // `cur` always becomes the next block (it's flushed before it could overflow), so that's where u lands.
    for (const a of u.anchors) if (!anchorBlock.has(a)) anchorBlock.set(a, blocks.length + 1);
    cur.push(u.md);
  }
  push();
  return { blocks, anchorBlock };
}

const parseXml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const parseHtml = (text: string) => {
  const x = new DOMParser().parseFromString(text, "application/xhtml+xml");
  return x.getElementsByTagName("parsererror").length ? new DOMParser().parseFromString(text, "text/html") : x;
};
const dirOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "");
function resolve(base: string, href: string): string {
  const parts = (dirOf(base) + decodeURIComponent(href)).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

async function unzip(file: File): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import("fflate");
  try {
    return unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new ReadError("This file is damaged or password-protected, so it can't be read.");
  }
}
const text = (files: Record<string, Uint8Array>, path: string) => (files[path] ? new TextDecoder().decode(files[path]) : null);

// A cover image, redrawn small as a JPEG (also turns any odd format into a safe one).
async function smallCover(blob: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const width = Math.min(360, bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round((bitmap.height / bitmap.width) * width);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.82));
  } catch {
    return null;
  }
}

// ---- EPUB ----

type TocEntry = { title: string; href: string; level: number };

function navEntries(navDoc: Document, navPath: string): TocEntry[] {
  const navs = Array.from(navDoc.getElementsByTagName("nav"));
  const toc = navs.find((n) => (n.getAttribute("epub:type") ?? n.getAttributeNS("http://www.idpf.org/2007/ops", "type") ?? "").includes("toc")) ?? navs[0];
  const out: TocEntry[] = [];
  const visit = (ol: Element, level: number) => {
    for (const li of Array.from(ol.children).filter((c) => c.localName === "li")) {
      const a = Array.from(li.children).find((c) => c.localName === "a" || c.localName === "span");
      const title = (a?.textContent ?? "").replace(/\s+/g, " ").trim();
      const href = a?.getAttribute("href");
      if (title && href) out.push({ title, href: resolve(navPath, href), level });
      const sub = Array.from(li.children).find((c) => c.localName === "ol");
      if (sub) visit(sub, level + 1);
    }
  };
  const ol = toc ? Array.from(toc.children).find((c) => c.localName === "ol") : null;
  if (ol) visit(ol, 1);
  return out;
}

function ncxEntries(ncx: Document, ncxPath: string): TocEntry[] {
  const out: TocEntry[] = [];
  const visit = (el: Element, level: number) => {
    for (const p of Array.from(el.children).filter((c) => c.localName === "navPoint")) {
      const title = (p.getElementsByTagName("text")[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
      const src = p.getElementsByTagName("content")[0]?.getAttribute("src");
      if (title && src) out.push({ title, href: resolve(ncxPath, src), level });
      visit(p, level + 1);
    }
  };
  const map = ncx.getElementsByTagName("navMap")[0];
  if (map) visit(map, 1);
  return out;
}

export async function readEpub(file: File): Promise<ReadResult> {
  const files = await unzip(file);
  const container = text(files, "META-INF/container.xml");
  const opfPath = container ? parseXml(container).getElementsByTagName("rootfile")[0]?.getAttribute("full-path") : null;
  const opfText = opfPath ? text(files, opfPath) : null;
  if (!opfPath || !opfText) throw new ReadError("This doesn't look like an EPUB book.");
  const encryption = text(files, "META-INF/encryption.xml");
  if (encryption && /EncryptedData/.test(encryption) && !/obfuscation|font/i.test(encryption)) throw new ReadError("This EPUB is protected (DRM), so it can't be read here.");

  const opf = parseXml(opfText);
  const title = (opf.getElementsByTagName("dc:title")[0]?.textContent ?? opf.getElementsByTagNameNS("*", "title")[0]?.textContent ?? "").trim();
  const manifest = new Map<string, { href: string; type: string; props: string }>();
  for (const item of Array.from(opf.getElementsByTagName("item")))
    manifest.set(item.getAttribute("id") ?? "", { href: resolve(opfPath, item.getAttribute("href") ?? ""), type: item.getAttribute("media-type") ?? "", props: item.getAttribute("properties") ?? "" });
  const spine = Array.from(opf.getElementsByTagName("itemref"))
    .filter((r) => r.getAttribute("linear") !== "no")
    .map((r) => manifest.get(r.getAttribute("idref") ?? "")?.href)
    .filter((h): h is string => !!h && !!files[h]);
  if (!spine.length) throw new ReadError("This EPUB has no chapters to read.");

  // Contents: EPUB 3 nav, else EPUB 2 NCX.
  const navItem = [...manifest.values()].find((m) => m.props.split(/\s+/).includes("nav"));
  const ncxItem = [...manifest.values()].find((m) => m.type === "application/x-dtbncx+xml");
  let toc: TocEntry[] = [];
  if (navItem && text(files, navItem.href)) toc = navEntries(parseHtml(text(files, navItem.href)!), navItem.href);
  if (!toc.length && ncxItem && text(files, ncxItem.href)) toc = ncxEntries(parseXml(text(files, ncxItem.href)!), ncxItem.href);

  // Text: every spine file in order; each starts a new block. Headings h1/h2 start blocks too.
  const units: Unit[] = [];
  const fileTitles = new Map<string, string>();
  for (const href of spine) {
    if (navItem && href === navItem.href && toc.length) continue; // the contents page itself
    const doc = parseHtml(text(files, href)!);
    const heading = doc.querySelector?.("h1, h2, h3")?.textContent?.replace(/\s+/g, " ").trim();
    if (heading) fileTitles.set(href, heading);
    units.push(...htmlUnits(doc, href, 2));
  }
  const { blocks, anchorBlock } = toBlocks(units);
  if (!blocks.length) throw new ReadError("We couldn't find any text in this EPUB.");

  const blockFor = (href: string) => anchorBlock.get(href) ?? anchorBlock.get(href.split("#")[0]);
  let sections: TextSection[] = toc
    .map((e, i) => ({ key: `t${i}`, title: e.title.slice(0, 300), level: Math.min(6, e.level), page: blockFor(e.href) }))
    .filter((s): s is { key: string; title: string; level: number; page: number } => !!s.page)
    .map((s) => ({ key: s.key, title: s.title, level: s.level, locator: { kind: "text" as const, page: s.page } }));
  if (!sections.length)
    sections = spine
      .map((href, i) => ({ href, i, page: anchorBlock.get(href) }))
      .filter((s) => s.page && fileTitles.get(s.href))
      .map((s) => ({ key: `f${s.i}`, title: fileTitles.get(s.href)!.slice(0, 300), level: 1, locator: { kind: "text" as const, page: s.page! } }));

  // The book's own cover image.
  const coverId = opf.querySelector?.('meta[name="cover"]')?.getAttribute("content");
  const coverItem = [...manifest.values()].find((m) => m.props.includes("cover-image")) ?? (coverId ? manifest.get(coverId) : undefined);
  const coverBytes = coverItem && coverItem.type.startsWith("image/") ? files[coverItem.href] : undefined;
  const cover = coverBytes ? await smallCover(new Blob([coverBytes as BlobPart], { type: coverItem!.type })) : null;

  return { title: title || file.name.replace(/\.epub$/i, ""), blocks, sections, cover };
}

// ---- Word (.docx) via mammoth ----

export async function readDocx(file: File): Promise<ReadResult> {
  const mammoth = await import("mammoth");
  let html: string;
  try {
    html = (await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })).value;
  } catch {
    throw new ReadError("This Word file is damaged or password-protected, so it can't be read.");
  }
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  // Headings become the contents: mark each one so its block can be found.
  const heads = Array.from(doc.querySelectorAll("h1, h2"));
  heads.forEach((h, i) => h.setAttribute("id", `ingrain-h${i}`));
  const { blocks, anchorBlock } = toBlocks(htmlUnits(doc, "doc", 2));
  if (!blocks.length) throw new ReadError("We couldn't find any text in this Word file.");
  const name = file.name.replace(/\.docx$/i, "");
  const firstH1 = doc.querySelector("h1")?.textContent?.trim();
  let sections: TextSection[] = heads
    .map((h, i) => ({ key: `h${i}`, title: (h.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 300), level: h.localName === "h1" ? 1 : 2, page: anchorBlock.get(`doc#ingrain-h${i}`) }))
    .filter((s) => s.title && s.page)
    .map((s) => ({ key: s.key, title: s.title, level: s.level, locator: { kind: "text" as const, page: s.page! } }));
  if (!sections.length) sections = [{ key: "doc", title: (firstH1 || name).slice(0, 300), level: 1, locator: { kind: "text", page: 1 } }];
  return { title: (firstH1 && firstH1.length < 120 ? firstH1 : name) || "Untitled", blocks, sections, cover: null };
}

// ---- PowerPoint (.pptx): slide text only ----

export async function readPptx(file: File): Promise<ReadResult> {
  const files = await unzip(file);
  const pres = text(files, "ppt/presentation.xml");
  const rels = text(files, "ppt/_rels/presentation.xml.rels");
  if (!pres || !rels) throw new ReadError("This doesn't look like a PowerPoint (.pptx) file.");
  const units: Unit[] = [];
  const sections: TextSection[] = [];
  slideOrder(pres, rels).forEach((path, i) => {
    const xml = text(files, path);
    if (!xml) return;
    const { title, lines } = slideText(xml);
    const heading = `### Slide ${i + 1}${title ? `: ${escapeMarkdown(title)}` : ""}`;
    units.push({ md: [heading, ...lines.map((l) => `- ${escapeMarkdown(l)}`)].join("\n"), anchors: [`slide${i}`], breakBefore: true });
  });
  const { blocks, anchorBlock } = toBlocks(units);
  if (!blocks.length) throw new ReadError("We couldn't find any text on these slides.");
  units.forEach((u, i) => {
    const page = anchorBlock.get(`slide${i}`);
    const t = u.md.split("\n")[0].replace(/^### /, "").replace(/\\(.)/g, "$1");
    if (page) sections.push({ key: `s${i + 1}`, title: t.slice(0, 300), level: 1, locator: { kind: "text", page } });
  });
  return { title: file.name.replace(/\.pptx$/i, "") || "Slides", blocks, sections, cover: null, note: "Slide text only: pictures and layout aren't kept. To keep the slides, save as PDF in PowerPoint." };
}

export async function readTextFile(file: File, kind: TextKind): Promise<ReadResult> {
  return kind === "epub" ? readEpub(file) : kind === "word" ? readDocx(file) : readPptx(file);
}
