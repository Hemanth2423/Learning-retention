// The one export builder (TEAM-PLAN.md): a book → its chapters in book order, each with notes, highlights (with
// comments) and saved questions. Markdown download, Copy all and Print use it; Notion and Google Docs can too.
// Pure, so it runs in the browser or in a Convex action, and is tested in exportRules.test.ts.
import { ChapterRange, SectionLike } from "./chapters";
import { chapterParts } from "./notebookRules";

export type ExportOptions = { notes: boolean; highlights: boolean; saved: boolean };
export const ALL_PARTS: ExportOptions = { notes: true, highlights: true, saved: true };

export type ExportNote = { sectionKey: string | null; content: string; plainText: string; seconds?: number | null; createdAt: number };
export type ExportHighlight = { page: number; text: string; comment?: string; order: number };
export type ExportSaved = { chapterKey: string; question: string; yourAnswer: string; rightAnswer: string; page?: number; createdAt: number };

export type ExportSection = {
  key: string;
  title: string;
  part?: string;
  notes: { markdown: string; seconds?: number }[];
  highlights: { text: string; comment?: string; where: string }[];
  saved: ExportSaved[];
};
export type ExportBook = { title: string; source?: string; sections: ExportSection[] };

// ---- Notes: the editor's JSON (Tiptap) → Markdown. Anything typed is text: HTML and Markdown characters are escaped.
type TipNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string }[]; content?: TipNode[] };

export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_[\]#<>|~])/g, "\\$1");
}

function inline(nodes: TipNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      if (n.type === "image") return typeof n.attrs?.src === "string" ? `![](${n.attrs.src})` : "";
      let t = escapeMarkdown(n.text ?? "");
      if (!t.trim()) return t;
      const marks = new Set((n.marks ?? []).map((m) => m.type));
      if (marks.has("bold")) t = `**${t}**`;
      if (marks.has("italic")) t = `*${t}*`;
      if (marks.has("strike")) t = `~~${t}~~`;
      if (marks.has("underline")) t = `<u>${t}</u>`;
      return t;
    })
    .join("");
}

function blocks(nodes: TipNode[] = [], indent = ""): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.type === "paragraph") out.push(indent + inline(n.content));
    else if (n.type === "heading") out.push(`${indent}${(n.attrs?.level as number) >= 3 ? "####" : "###"} ${inline(n.content)}`);
    else if (n.type === "image") out.push(indent + inline([n]));
    else if (n.type === "bulletList" || n.type === "orderedList") {
      // One block per list, one line per item (nested content indented under its item).
      const lines: string[] = [];
      (n.content ?? []).forEach((item, i) => {
        const bullet = n.type === "bulletList" ? "- " : `${i + 1}. `;
        const [first, ...rest] = blocks(item.content, "");
        lines.push(`${indent}${bullet}${first ?? ""}`);
        for (const r of rest) lines.push(...r.split("\n").map((l) => `${indent}${" ".repeat(bullet.length)}${l}`));
      });
      out.push(lines.join("\n"));
    } else if (n.content) out.push(...blocks(n.content, indent));
  }
  return out;
}

export function noteToMarkdown(content: string, plainText: string): string {
  try {
    const doc = JSON.parse(content) as TipNode;
    const md = blocks(doc.content).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    if (md) return md;
  } catch {
    /* not editor JSON: fall back to the plain copy */
  }
  return escapeMarkdown(plainText.trim());
}

// ---- The book structure ----

const formatTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

export function buildExport(input: {
  title: string;
  source?: string; // e.g. "Article · paulgraham.com · https://…"
  ranges: ChapterRange[];
  sections: (SectionLike & { title: string })[];
  notes: ExportNote[];
  highlights: ExportHighlight[];
  saved: ExportSaved[];
  options?: ExportOptions;
  pageLabel?: "p." | "§";
}): ExportBook {
  const o = input.options ?? ALL_PARTS;
  const known = new Set(input.ranges.map((r) => r.key));
  const rangeOf = (page: number) => input.ranges.find((r) => page >= r.startPage && page <= r.endPage)?.key ?? null;
  const label = input.pageLabel ?? "p.";
  const sortNotes = (n: ExportNote[]) => [...n].sort((a, b) => (a.seconds ?? -1) - (b.seconds ?? -1) || a.createdAt - b.createdAt);
  const noteOut = (n: ExportNote) => ({ markdown: noteToMarkdown(n.content, n.plainText), ...(n.seconds != null ? { seconds: n.seconds } : {}) });

  const sections: ExportSection[] = [];
  const parts = chapterParts(input.sections, input.ranges.map((r) => r.key));
  const general = o.notes ? input.notes.filter((n) => n.sectionKey === null || !known.has(n.sectionKey)) : [];
  if (general.length) sections.push({ key: "general", title: "General notes", notes: sortNotes(general).map(noteOut), highlights: [], saved: [] });

  for (const r of input.ranges) {
    const s: ExportSection = {
      key: r.key,
      title: r.title,
      part: parts.get(r.key),
      notes: o.notes ? sortNotes(input.notes.filter((n) => n.sectionKey === r.key)).map(noteOut) : [],
      highlights: o.highlights
        ? input.highlights
            .filter((h) => rangeOf(h.page) === r.key)
            .sort((a, b) => a.order - b.order)
            .map((h) => ({ text: h.text, ...(h.comment ? { comment: h.comment } : {}), where: `${label}${label === "§" ? "" : " "}${h.page}` }))
        : [],
      saved: o.saved ? input.saved.filter((q) => q.chapterKey === r.key).sort((a, b) => a.createdAt - b.createdAt) : [],
    };
    if (s.notes.length || s.highlights.length || s.saved.length) sections.push(s);
  }
  return { title: input.title, source: input.source, sections };
}

export function isEmptyExport(book: ExportBook): boolean {
  return book.sections.length === 0;
}

// ---- Markdown (download, Copy all; Obsidian reads it as is) ----

export function toMarkdown(book: ExportBook, exportedOn?: string): string {
  const lines: string[] = [`# ${escapeMarkdown(book.title)}`, ""];
  if (book.source) lines.push(`*${escapeMarkdown(book.source)}*`, "");
  if (exportedOn) lines.push(`*Exported from Ingrain on ${exportedOn}*`, "");
  const hasParts = book.sections.some((s) => s.part);
  let lastPart: string | undefined;
  for (const s of book.sections) {
    if (hasParts && s.part && s.part !== lastPart) {
      lines.push(`## ${escapeMarkdown(s.part)}`, "");
      lastPart = s.part;
    }
    lines.push(`${hasParts && s.key !== "general" ? "###" : "##"} ${escapeMarkdown(s.title)}`, "");
    for (const n of s.notes) lines.push(n.seconds !== undefined ? `**[${formatTime(n.seconds)}]** ${n.markdown}` : n.markdown, "");
    for (const h of s.highlights) {
      lines.push(`> ${escapeMarkdown(h.text)} (${h.where})`, "");
      if (h.comment) lines.push(`💬 ${escapeMarkdown(h.comment)}`, "");
    }
    for (const q of s.saved) {
      lines.push(`**Q: ${escapeMarkdown(q.question)}**`, `- Your answer: ~~${escapeMarkdown(q.yourAnswer)}~~`, `- Right answer: **${escapeMarkdown(q.rightAnswer)}**`, "");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ---- HTML for Print / Save as PDF (everything escaped; notes come in as Markdown text, shown as text) ----

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Notes in the print view: the Markdown is turned into simple paragraphs and lists (no HTML from the note is used).
function noteHtml(md: string): string {
  const unescape = (t: string) => t.replace(/\\([\\`*_[\]#<>|~])/g, "$1");
  const fmt = (t: string) =>
    escapeHtml(unescape(t))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/~~(.+?)~~/g, "<s>$1</s>")
      .replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, "<u>$1</u>")
      .replace(/!\[\]\((https:[^)\s]+)\)/g, '<img src="$1" alt="">');
  return md
    .split(/\n\n/)
    .map((block) => {
      const items = block.split("\n");
      if (items.every((l) => /^(\s*)(- |\d+\. )/.test(l))) return `<ul>${items.map((l) => `<li>${fmt(l.replace(/^\s*(- |\d+\. )/, ""))}</li>`).join("")}</ul>`;
      const h = block.match(/^(#{3,4}) (.*)$/);
      if (h) return `<h4>${fmt(h[2])}</h4>`;
      return `<p>${fmt(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function toPrintHtml(book: ExportBook, exportedOn?: string): string {
  const parts: string[] = [];
  let lastPart: string | undefined;
  for (const s of book.sections) {
    if (s.part && s.part !== lastPart) {
      parts.push(`<h2 class="part">${escapeHtml(s.part)}</h2>`);
      lastPart = s.part;
    }
    parts.push(`<section><h2>${escapeHtml(s.title)}</h2>`);
    for (const n of s.notes) parts.push(`<div class="note">${n.seconds !== undefined ? `<b>[${formatTime(n.seconds)}]</b> ` : ""}${noteHtml(n.markdown)}</div>`);
    for (const h of s.highlights)
      parts.push(`<blockquote>${escapeHtml(h.text)} <span class="where">(${escapeHtml(h.where)})</span></blockquote>${h.comment ? `<p class="comment">💬 ${escapeHtml(h.comment)}</p>` : ""}`);
    for (const q of s.saved)
      parts.push(`<div class="q"><b>${escapeHtml(q.question)}</b><br>Your answer: <s>${escapeHtml(q.yourAnswer)}</s><br>Right answer: <b>${escapeHtml(q.rightAnswer)}</b></div>`);
    parts.push(`</section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(book.title)}</title><style>
body{font-family:Georgia,serif;color:#2a221b;max-width:700px;margin:32px auto;padding:0 24px;line-height:1.6}
h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:28px 0 8px;border-bottom:1px solid #dccfba;padding-bottom:4px}
h2.part{font-family:monospace;font-size:13px;color:#85361c;border:0;text-transform:uppercase}h4{margin:12px 0 4px}
.meta{color:#5b4e40;font-size:13px;margin:0 0 4px}.note{margin:0 0 12px}.note p{margin:0 0 8px}
blockquote{margin:8px 0;padding:2px 0 2px 12px;border-left:3px solid #e2bd52}.where{color:#5b4e40;font-size:12px}
.comment{margin:0 0 12px 15px;font-size:14px}.q{margin:8px 0 12px;font-size:14px}img{max-width:100%}
section{break-inside:auto}h2{break-after:avoid}
</style></head><body><h1>${escapeHtml(book.title)}</h1>${book.source ? `<p class="meta">${escapeHtml(book.source)}</p>` : ""}${
    exportedOn ? `<p class="meta">Exported from Ingrain on ${escapeHtml(exportedOn)}</p>` : ""
  }${parts.join("")}</body></html>`;
}

// "How to Do Great Work.md" without characters file systems reject.
export function exportFileName(title: string, ext = "md"): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "Notes";
  return `${base}.${ext}`;
}
