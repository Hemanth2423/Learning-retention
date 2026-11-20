// Rules for files read in the browser and stored as text blocks: EPUB, Word (.docx), PowerPoint (.pptx).
// Pure so they can be tested; the browser uses them for instant feedback and the server checks again.
import { MAX_BLOCK_CHARS } from "./linkRules";

export const TEXT_KINDS = ["epub", "word", "powerpoint"] as const;
export type TextKind = (typeof TEXT_KINDS)[number];
export type FileKind = TextKind | "pdf";

export const MAX_TEXT_BLOCKS = 3000; // ~4.5 MB of text: far more than a long book
export const MAX_STORED_BLOCK_CHARS = MAX_BLOCK_CHARS + 500; // a little room over the splitter's target
export const MAX_TEXT_SECTIONS = 1500;
export const BLOCK_BATCH = 100; // blocks sent to the server per call

const EXT: Record<string, FileKind> = { pdf: "pdf", epub: "epub", docx: "word", pptx: "powerpoint" };
export const KIND_LABEL: Record<FileKind, string> = { pdf: "PDF", epub: "EPUB", word: "Word", powerpoint: "PowerPoint" };

export function kindOfFile(name: string): FileKind | null {
  return EXT[name.toLowerCase().split(".").pop() ?? ""] ?? null;
}

// Why a file can't be added, in plain words (or undefined if it can).
export function unsupportedReason(name: string): string | undefined {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (kindOfFile(name)) return undefined;
  if (ext === "doc") return "Old Word files (.doc) can't be read. Save it as .docx in Word and add it again.";
  if (ext === "ppt") return "Old PowerPoint files (.ppt) can't be read. Save it as .pptx and add it again.";
  if (ext === "mobi" || ext === "azw" || ext === "azw3") return "Kindle files can't be read. Add an EPUB or PDF instead.";
  return "That file type isn't supported. Add a PDF, EPUB, Word (.docx) or PowerPoint (.pptx) file.";
}

// Groups paragraphs (Markdown) into blocks of up to `max` characters, never splitting a paragraph that fits;
// a paragraph longer than a block is cut at sentence ends.
export function splitBlocks(paragraphs: string[], max = MAX_BLOCK_CHARS): string[] {
  const out: string[] = [];
  let cur = "";
  const push = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;
    if (p.length > max) {
      push();
      let piece = "";
      for (const s of p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [p]) {
        if (piece && (piece + s).trim().length > max) {
          out.push(piece.trim());
          piece = "";
        }
        piece += s.length > max ? s.slice(0, max) : s;
      }
      if (piece.trim()) out.push(piece.trim());
      continue;
    }
    if (cur && cur.length + p.length + 2 > max) push();
    cur += (cur ? "\n\n" : "") + p;
  }
  push();
  return out;
}

export function validateBlocks(blocks: string[], startIndex: number, existing: number): string | undefined {
  if (startIndex !== existing) return "The text arrived out of order. Try adding the file again.";
  if (blocks.length === 0 || blocks.length > BLOCK_BATCH) return "That text couldn't be saved.";
  if (existing + blocks.length > MAX_TEXT_BLOCKS) return "This file is too long to read here. Try a shorter one, or a PDF.";
  if (blocks.some((b) => !b.trim() || b.length > MAX_STORED_BLOCK_CHARS)) return "That text couldn't be saved.";
  return undefined;
}

export type TextSection = { key: string; title: string; level: number; locator: { kind: "text"; page: number } };

export function validateSections(sections: TextSection[], blockCount: number): string | undefined {
  if (sections.length > MAX_TEXT_SECTIONS) return "This file has too many sections.";
  const keys = new Set<string>();
  for (const s of sections) {
    if (!s.key || keys.has(s.key) || s.key.length > 60) return "The contents of this file couldn't be read.";
    keys.add(s.key);
    if (!s.title.trim() || s.title.length > 300) return "The contents of this file couldn't be read.";
    if (!Number.isInteger(s.level) || s.level < 1 || s.level > 6) return "The contents of this file couldn't be read.";
    if (!Number.isInteger(s.locator.page) || s.locator.page < 1 || s.locator.page > blockCount) return "The contents of this file couldn't be read.";
  }
  return undefined;
}

// ---- PowerPoint: slide text from the slide's XML (no images). ----

const decodeXml = (t: string) =>
  t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

// The slide's title (from the title placeholder, else its first line) and its other lines, in order.
export function slideText(xml: string): { title: string; lines: string[] } {
  const shapes = xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) ?? [];
  let title = "";
  const lines: string[] = [];
  for (const shape of shapes) {
    const isTitle = /<p:ph\b[^>]*type="(title|ctrTitle)"/.test(shape);
    for (const para of shape.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
      const text = decodeXml((para.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? []).map((t) => t.replace(/<\/?a:t>/g, "")).join(""))
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      if (isTitle && !title) title = text;
      else if (isTitle) title += ` ${text}`;
      else lines.push(text);
    }
  }
  if (!title && lines.length) title = lines.shift()!;
  return { title, lines };
}

// Slide order from presentation.xml + its relationships: ["ppt/slides/slide3.xml", …].
export function slideOrder(presentationXml: string, relsXml: string): string[] {
  const targets = new Map<string, string>();
  for (const rel of relsXml.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = rel.match(/\bId="([^"]+)"/)?.[1];
    const target = rel.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target && /slides\/slide\d+\.xml$/.test(target)) targets.set(id, target.replace(/^\.?\/?/, "").replace(/^ppt\//, ""));
  }
  return (presentationXml.match(/<p:sldId\b[^>]*>/g) ?? [])
    .map((s) => s.match(/r:id="([^"]+)"/)?.[1])
    .map((id) => (id ? targets.get(id) : undefined))
    .filter((t): t is string => !!t)
    .map((t) => `ppt/${t}`);
}
