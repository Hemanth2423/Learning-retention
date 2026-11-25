// Rules for adding an article or YouTube video by link. Pure, so they can be tested without the network.

export const MAX_URL = 2000;
export const MAX_BLOCK_CHARS = 1500; // one "block" of an article ≈ a short page; Ask and citations work per block
export const MAX_ARTICLE_CHARS = 300_000; // longer pages are cut (a long essay is ~70k)
export const MIN_ARTICLE_CHARS = 300; // less readable text than this = paywall or a script-only page

export type ParsedLink =
  | { kind: "video"; url: string; videoId: string }
  | { kind: "playlist"; url: string; listId: string }
  | { kind: "article"; url: string; host: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
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
    // A playlist page. (A video watched from a playlist, watch?v=…&list=…, stays that one video.)
    const list = u.searchParams.get("list");
    if (u.pathname.replace(/\/+$/, "") === "/playlist" && list && PLAYLIST_ID.test(list)) return { kind: "playlist", url: `https://www.youtube.com/playlist?list=${list}`, listId: list };
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

// ---- Reader view: what a site wraps around the article ----

// Whole lines that are buttons or counters, not writing.
const BUTTON_LINE = /^(subscribe( now)?|sign ?in|subscribe ?sign ?in|share( this post)?|read in app|open in app|upgrade to paid|get the app)$/i; // anywhere
// Ordinary words ("Notes", "Top") that are only buttons near the top of the page.
const HEAD_CHROME = /^(log ?in|sign ?up|like|likes|comment|comments|restack|restacks|save|listen|follow|following|copy link|facebook|email|notes?|more|top|latest|discussion|[·∙•]?\s*(paid|free)|[·∙•]?\s*\d+\s*min read)$/i;
const BARE_COUNT = /^[\d.,]+\s*[kKmM]?$/;
// Small profile pictures (Substack sizes them in the URL), or anything named as an avatar.
const AVATAR = /!\[[^\]]*\]\([^)]*(?:[,/]w_(?:\d{1,2}|1[01]\d|120)[,/]|avatar|profile[-_]?(?:pic|photo|image))[^)]*\)/i;
// Where the free part of a paywalled post stops.
const PAYWALL =
  /(this post is for (paid )?subscribers|this (post|article|story) is (only )?(for|available to) (paid )?(subscribers|members)|keep reading with a \d+-day free trial|subscribe to .{1,60} to (keep|continue) reading|already a paid subscriber|continue reading with a|subscribe to (read|continue|unlock)|you('|’)ve reached your (free )?(article|story) limit|member-only story)/i;
// Where the article has ended and the site's own page carries on.
const PAGE_TAIL = /^#*\s*\**(discussion about this post|ready for more\?|recommended for you|more from .{1,50}|related (posts|articles|stories)|you might also like)\**\s*$/i;
const HEAD_LINES = 25; // counters and buttons only count as chrome near the top, so a "42" in the article survives

const plain = (t: string) => t.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();

// The article's blocks as a reader should see them: no buttons, counters, profile pictures, repeated title, or the
// site's page after the article. `partial` = the site only gave the free part. Runs when reading, so the stored text
// is never changed and articles added earlier are cleaned too.
export function cleanArticleBlocks<T extends { page: number; text: string }>(blocks: T[], title = ""): { blocks: T[]; partial: boolean } {
  const out: T[] = [];
  const wanted = plain(title).toLowerCase();
  let seen = 0;
  let partial = false;
  let ended = false;
  for (const block of blocks) {
    if (ended) break;
    const lines: string[] = [];
    for (const line of block.text.split("\n")) {
      const t = plain(line);
      if (!t && !/!\[/.test(line)) {
        lines.push(line);
        continue;
      }
      if (PAYWALL.test(t)) {
        partial = true;
        ended = true;
        break;
      }
      if (PAGE_TAIL.test(t)) {
        ended = true;
        break;
      }
      const head = seen < HEAD_LINES;
      seen++;
      if (BUTTON_LINE.test(t)) continue;
      if (head && (HEAD_CHROME.test(t) || BARE_COUNT.test(t) || AVATAR.test(line))) continue;
      if (head && wanted && t.toLowerCase() === wanted) continue; // the page already shows the title
      lines.push(line);
    }
    const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text) out.push({ ...block, text });
  }
  return { blocks: out, partial };
}

// ---- Showing the original page inside the app ----

// Only public web hosts: this is what lets the server look at a reader-supplied link's headers safely.
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || h.includes(":")) return false; // no single-label names, no IPv6 literals
  if (/\.(local|internal|localhost|intranet|lan|home|corp)$/.test(h)) return false;
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(h); // real sites have names; IP literals could point inside a network
}

// Does this response let another site show the page in a frame?
export function allowsFraming(headers: { xFrameOptions?: string | null; csp?: string | null }): boolean {
  if (headers.xFrameOptions?.trim()) return false; // DENY or SAMEORIGIN
  const directive = (headers.csp ?? "")
    .split(";")
    .map((d) => d.trim().toLowerCase())
    .find((d) => d.startsWith("frame-ancestors"));
  if (!directive) return true;
  return directive.split(/\s+/).slice(1).includes("*");
}

// ---- YouTube playlists (Data API) ----

export const MAX_PLAYLIST_VIDEOS = 200;
export type PlaylistVideo = { videoId: string; title: string; channel: string };

// One page of playlistItems → the videos a reader can watch (private and deleted ones are left out).
export function playlistPageVideos(page: unknown): { videos: PlaylistVideo[]; hidden: number; next?: string } {
  const p = page as { nextPageToken?: string; items?: { snippet?: { title?: string; videoOwnerChannelTitle?: string; resourceId?: { videoId?: string } }; status?: { privacyStatus?: string } }[] };
  const videos: PlaylistVideo[] = [];
  let hidden = 0;
  for (const item of p.items ?? []) {
    const id = item.snippet?.resourceId?.videoId;
    const title = (item.snippet?.title ?? "").trim();
    const gone = !id || !VIDEO_ID.test(id) || !title || /^(private|deleted) video$/i.test(title) || item.status?.privacyStatus === "private";
    if (gone) hidden++;
    else videos.push({ videoId: id, title: title.slice(0, 120), channel: (item.snippet?.videoOwnerChannelTitle ?? "YouTube").replace(/ - Topic$/, "").trim() || "YouTube" });
  }
  return { videos, hidden, next: p.nextPageToken };
}

// ---- Staying well inside YouTube's quota (ADR 018) ----

export const YOUTUBE_DAILY_QUOTA = 10_000; // Google's default units per day
export const YOUTUBE_DAILY_BUDGET = 1_000; // our hard cap: 10% of the quota, for the whole app
export const YOUTUBE_USER_DAILY_BUDGET = 50; // one reader can't use up the app's budget (10 of the largest playlists)
export const YOUTUBE_QUOTA_TIME_ZONE = "America/Los_Angeles"; // Google resets the quota at midnight Pacific
// The most one add can cost: 1 unit for the playlist + 1 per page of 50 videos.
export const PLAYLIST_MAX_UNITS = 1 + Math.ceil(MAX_PLAYLIST_VIDEOS / 50);

export function youtubeBudgetProblem(spent: { all: number; user: number }, units: number): string | undefined {
  if (spent.all + units > YOUTUBE_DAILY_BUDGET) return "Playlists have reached today's limit. Try again tomorrow.";
  if (spent.user + units > YOUTUBE_USER_DAILY_BUDGET) return "You've added a lot of playlists today. Try again tomorrow.";
  return undefined;
}

export const youtubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
export const siteNameOf = (host: string) => host.replace(/^www\./, "");
