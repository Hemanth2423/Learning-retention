// Rules for adding an article or YouTube video by link. Pure, so they can be tested without the network.

export const MAX_URL = 2000;
export const MAX_BLOCK_CHARS = 1500; // one "block" of an article ≈ a short page; Ask and citations work per block
export const MAX_ARTICLE_CHARS = 300_000; // longer pages are cut (a long essay is ~70k)
export const MIN_ARTICLE_CHARS = 300; // less readable text than this = paywall or a script-only page

export type ParsedLink = { kind: "video"; url: string; videoId: string } | { kind: "article"; url: string; host: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
// Tracking parameters that don't change the page; removed so the same article isn't added twice.
const TRACKING = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src|ref_url|s_cid|si|_hsenc|_hsmi|mkt_tok)$/i;

function youtubeId(u: URL, host: string): string | null {
  if (host === "youtu.be") return u.pathname.split("/")[1] ?? null;
  if (u.pathname === "/watch") return u.searchParams.get("v");
  const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
  return m ? m[2] : null;
}

// A link → what it is and the one canonical form we store (used to spot duplicates). null = not a usable link.
export function parseLink(raw: string): ParsedLink | null {
  let text = raw.trim();
  if (!text || text.length > MAX_URL || /\s/.test(text)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) text = `https://${text}`; // "paulgraham.com/x" is fine
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".") || u.username || u.password) return null;

  if (YOUTUBE_HOSTS.has(host)) {
    const id = youtubeId(u, host);
    if (!id || !VIDEO_ID.test(id)) return null;
    return { kind: "video", url: `https://www.youtube.com/watch?v=${id}`, videoId: id };
  }

  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : "";
  const port = u.port ? `:${u.port}` : "";
  return { kind: "article", url: `https://${host}${port}${path}${query}`, host };
}

// Firecrawl's Markdown for older sites often wraps the article in layout tables and spacer images, and turns every
// line break into <br>. Keep the words: drop table scaffolding and image-only cells; <br><br> starts a new paragraph,
// a single <br> is just a line wrap.
const IMAGE_ONLY = /^(\[?!\[[^\]]*\]\([^)]*\)\]?(\([^)]*\))?\s*)+$/;
export function cleanArticleMarkdown(md: string): string {
  const out: string[] = [];
  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    const t = line.trim();
    if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(t)) continue; // | --- | --- |
    if (t.startsWith("|")) {
      const cells = t
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c && !IMAGE_ONLY.test(c))
        .map((c) => c.replace(/^(\[?!\[[^\]]*\]\([^)]*\)\]?(\([^)]*\))?\s*)+/, "").trim())
        .filter(Boolean);
      out.push(...cells.flatMap((c) => [c, ""]));
      continue;
    }
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/(\s*<br\s*\/?>\s*){2,}/gi, "\n\n")
    .split("\n")
    .map(unwrapLines)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_ARTICLE_CHARS);
}

// Some sites hard-wrap text with single <br>s (about 70 characters a line) and Firecrawl drops the blank line between
// paragraphs. A line that ends a sentence and is clearly shorter than the wrap width is a paragraph's last line.
const SENTENCE_END = /[.?!:"'”’)\]]$/;
export function unwrapLines(text: string): string {
  const lines = text.split(/\s*<br\s*\/?>\s*/i);
  if (lines.length < 2) return text;
  if (lines.length < 12) return lines.join(" "); // a few <br>s are just line breaks
  const widths = lines.map((l) => l.length).sort((a, b) => a - b);
  const wrap = widths[Math.floor(widths.length * 0.9)];
  const paras: string[] = [];
  let cur: string[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    cur.push(line);
    const next = lines[i + 1]?.trim() ?? "";
    const endsSentence = SENTENCE_END.test(line) && line.length < wrap * 0.85;
    const standsAlone = line.length < wrap * 0.5 && /^[A-Z0-9"“]/.test(next); // e.g. a date or a heading line
    if (endsSentence || standsAlone) {
      paras.push(cur.join(" "));
      cur = [];
    }
  });
  if (cur.length) paras.push(cur.join(" "));
  return paras.filter(Boolean).join("\n\n");
}

// The article split into blocks at paragraph breaks, each at most MAX_BLOCK_CHARS (a very long paragraph is cut).
export function splitArticle(md: string, max = MAX_BLOCK_CHARS): string[] {
  const blocks: string[] = [];
  let cur = "";
  for (const para of md.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    for (let piece = para; piece; piece = piece.slice(max)) {
      const part = piece.slice(0, max);
      if (cur && cur.length + part.length + 2 > max) {
        blocks.push(cur);
        cur = "";
      }
      cur = cur ? `${cur}\n\n${part}` : part;
      if (piece.length <= max) break;
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

// Text a reader can actually use: not a cookie wall or "subscribe to read".
export function readableEnough(md: string): boolean {
  const words = md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#>*_`|-]/g, " ");
  return words.replace(/\s+/g, " ").trim().length >= MIN_ARTICLE_CHARS;
}

export const youtubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
export const siteNameOf = (host: string) => host.replace(/^www\./, "");
