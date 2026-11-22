import { getAuthUserId } from "@convex-dev/auth/server";
import { folderForNewItem, insertFolder } from "./folders";
import { canHaveSubfolder, MAX_FOLDER_NAME, MAX_FOLDERS, normalizeFolderName, uniqueFolderName } from "./folderRules";
import { MAX_TEXT_BLOCKS } from "./textSourceRules";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalMutation, MutationCtx, query } from "./_generated/server";
import { dayKey } from "./xpRules";
import { getOwnDocument, requireUser } from "./helpers";
import { allowsFraming, cleanArticleMarkdown, isPublicHost, MAX_PLAYLIST_VIDEOS, parseLink, PLAYLIST_MAX_UNITS, YOUTUBE_QUOTA_TIME_ZONE, youtubeBudgetProblem, playlistPageVideos, PlaylistVideo, readableEnough, siteNameOf, splitArticle, youtubeThumb } from "./linkRules";

// Adding an article or a YouTube video by link (Feature 3, slice 1). All network calls happen here, on the server:
// Firecrawl reads the article once; YouTube oEmbed gives the video's title and channel. Nothing is re-fetched later.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const OEMBED_URL = "https://www.youtube.com/oembed";
const TIMEOUT_MS = 45_000;

export type AddLinkResult =
  | { ok: true; documentId: Id<"documents">; savedAsLink?: boolean; message?: string }
  | { ok: false; message: string; documentId?: Id<"documents"> };

// Step 1: refuse duplicates and reserve the item, in one transaction (two quick clicks can't add it twice).
export const begin = internalMutation({
  args: { userId: v.id("users"), url: v.string(), kind: v.union(v.literal("article"), v.literal("video")), videoId: v.optional(v.string()), title: v.string(), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { userId, url, kind, videoId, title, folderId }): Promise<AddLinkResult> => {
    const existing = await ctx.db.query("documents").withIndex("by_user_source", (q) => q.eq("userId", userId).eq("sourceUrl", url)).first();
    if (existing) return { ok: false, message: "That's already in your library.", documentId: existing._id };
    const documentId = await ctx.db.insert("documents", {
      userId,
      title,
      sourceType: kind,
      sourceUrl: url,
      videoId,
      folderId: await folderForNewItem(ctx, userId, folderId),
      status: "processing",
      statusMessage: kind === "video" ? "Adding the video…" : "Reading the article…",
    });
    return { ok: true, documentId };
  },
});

// Step 2: save what was fetched. Articles keep their text as blocks so Ask and notes work like a book's pages.
export const finish = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    title: v.string(),
    siteName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    blocks: v.array(v.string()),
    statusMessage: v.optional(v.string()),
  },
  handler: async (ctx, { documentId, userId, title, siteName, imageUrl, blocks, statusMessage }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return; // removed while it was being added
    for (let i = 0; i < blocks.length; i++) {
      await ctx.db.insert("chunks", { documentId, userId, index: i, text: blocks[i], locator: { kind: "text", page: i + 1 } });
    }
    const key = doc.sourceType === "video" ? "video" : "article";
    await ctx.db.patch(documentId, {
      title: title.slice(0, 120),
      siteName,
      imageUrl,
      status: "ready",
      statusMessage,
      hasText: blocks.length > 0,
      pageCount: Math.max(1, blocks.length),
      // One "chapter" covering the whole item, so the existing note and Ask code work unchanged.
      sections: [{ key, title: title.slice(0, 120), level: 1, locator: { kind: "text", page: 1 } }],
      // No lastReadAt: it's "New" in the library until it's opened (adding no longer opens it).
    });
  },
});

export const abort = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    if (await ctx.db.get(documentId)) await ctx.db.delete(documentId);
  },
});

const httpsOrUndefined = (u: unknown) => (typeof u === "string" && /^https:\/\//i.test(u) && u.length <= 2000 ? u : undefined);
const firstString = (u: unknown) => (Array.isArray(u) ? u.find((x) => typeof x === "string") : u);

export const add = action({
  args: { url: v.string(), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { url, folderId }): Promise<AddLinkResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, message: "Please log in first." };
    const link = parseLink(url);
    if (!link) return { ok: false, message: "That doesn't look like an article or YouTube link." };
    if (link.kind === "playlist") return { ok: false, message: "That's a playlist: add it from the Links tab." };

    const placeholder = link.kind === "video" ? "YouTube video" : siteNameOf(link.host);
    const start = await ctx.runMutation(internal.links.begin, { userId, url: link.url, kind: link.kind, videoId: link.kind === "video" ? link.videoId : undefined, title: placeholder, folderId });
    if (!start.ok) return start;
    const { documentId } = start;

    try {
      if (link.kind === "video") {
        const res = await fetch(`${OEMBED_URL}?url=${encodeURIComponent(link.url)}&format=json`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
          // 401/403/404: private, removed or not embeddable. Nothing is saved.
          await ctx.runMutation(internal.links.abort, { documentId });
          return { ok: false, message: "This video isn't available. It may be private or removed." };
        }
        const info = (await res.json()) as { title?: string; author_name?: string };
        await ctx.runMutation(internal.links.finish, {
          documentId,
          userId,
          title: (info.title ?? "").trim() || "YouTube video",
          siteName: (info.author_name ?? "").trim() || "YouTube",
          imageUrl: youtubeThumb(link.videoId),
          blocks: [],
        });
        return { ok: true, documentId };
      }

      // Article: one Firecrawl call. A page we can't read (paywall, login, script-only) is still saved, as a link.
      const key = process.env.FIRECRAWL_API_KEY;
      let markdown = "";
      let title = "";
      let image: string | undefined;
      let site: string | undefined;
      let status = 0;
      if (key) {
        const res = await fetch(FIRECRAWL_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: link.url, formats: ["markdown"], onlyMainContent: true, excludeTags: ["nav", "footer", "aside", "button", "svg"] }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { markdown?: string; metadata?: Record<string, unknown> } };
        const meta = body.data?.metadata ?? {};
        status = typeof meta.statusCode === "number" ? meta.statusCode : res.ok ? 200 : res.status;
        markdown = res.ok && body.success !== false ? cleanArticleMarkdown(body.data?.markdown ?? "") : "";
        title = String(firstString(meta.ogTitle) ?? firstString(meta.title) ?? "").trim();
        image = httpsOrUndefined(firstString(meta.ogImage));
        site = String(firstString(meta.ogSiteName) ?? "").trim() || undefined;
      }
      if (status === 404 || status === 410) {
        await ctx.runMutation(internal.links.abort, { documentId });
        return { ok: false, message: "We couldn't find that page. Check the link and try again." };
      }
      const readable = readableEnough(markdown);
      await ctx.runMutation(internal.links.finish, {
        documentId,
        userId,
        title: title || siteNameOf(link.host),
        siteName: site ?? siteNameOf(link.host),
        imageUrl: image,
        blocks: readable ? splitArticle(markdown) : [],
        statusMessage: readable ? undefined : "We couldn't read this page here (it may need a login or subscription). It's saved as a link.",
      });
      return readable ? { ok: true, documentId } : { ok: true, documentId, savedAsLink: true, message: "Saved as a link: we couldn't read this page here." };
    } catch (err) {
      console.error("[links] add failed", err);
      await ctx.runMutation(internal.links.abort, { documentId });
      return { ok: false, message: "We couldn't add that link just now. Try again." };
    }
  },
});

export type AddPlaylistResult =
  | { ok: true; folderId: Id<"folders">; name: string; added: number; alreadyHad: number; hidden: number; capped: boolean; updated: boolean }
  | { ok: false; message: string };

// Saves a playlist as a folder of videos, in playlist order. Adding the same playlist again updates its folder.
// Videos already in the library aren't duplicated: they stay where they're filed (or join this folder if unfiled).
export const savePlaylist = internalMutation({
  args: {
    userId: v.id("users"),
    listId: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    videos: v.array(v.object({ videoId: v.string(), title: v.string(), channel: v.string() })),
  },
  handler: async (ctx, { userId, listId, name, parentId, videos }) => {
    const all = await ctx.db.query("folders").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_FOLDERS + 1);
    let folderId = all.find((f) => f.playlistId === listId)?._id;
    const updated = !!folderId;
    if (!folderId) {
      const parent = parentId && all.some((f) => f._id === parentId) && canHaveSubfolder(all, parentId) ? parentId : undefined;
      const siblings = all.filter((f) => (f.parentId ?? undefined) === parent).map((f) => f.name);
      const clean = normalizeFolderName(name).slice(0, MAX_FOLDER_NAME) || "YouTube playlist";
      folderId = await insertFolder(ctx, userId, uniqueFolderName(clean, siblings), "🎬", parent);
      await ctx.db.patch(folderId, { playlistId: listId });
    }
    let added = 0;
    let alreadyHad = 0;
    // Newest first in the library, so inserting backwards shows video 1 first.
    for (const video of [...videos].reverse()) {
      const url = `https://www.youtube.com/watch?v=${video.videoId}`;
      const existing = await ctx.db.query("documents").withIndex("by_user_source", (q) => q.eq("userId", userId).eq("sourceUrl", url)).first();
      if (existing) {
        alreadyHad++;
        if (!existing.folderId) await ctx.db.patch(existing._id, { folderId });
        continue;
      }
      await ctx.db.insert("documents", {
        userId,
        title: video.title,
        sourceType: "video",
        sourceUrl: url,
        videoId: video.videoId,
        siteName: video.channel,
        imageUrl: youtubeThumb(video.videoId),
        folderId,
        status: "ready",
        hasText: false,
        pageCount: 1,
        sections: [{ key: "video", title: video.title, level: 1, locator: { kind: "text", page: 1 } }],
      });
      added++;
    }
    const folder = await ctx.db.get(folderId);
    return { folderId, name: folder?.name ?? name, added, alreadyHad, updated };
  },
});

const usageRow = (ctx: MutationCtx, day: string, scope: string) =>
  ctx.db.query("apiUsage").withIndex("by_api_day_scope", (q) => q.eq("api", "youtube").eq("day", day).eq("scope", scope)).first();

async function addUnits(ctx: MutationCtx, day: string, scope: string, units: number) {
  const row = await usageRow(ctx, day, scope);
  if (row) await ctx.db.patch(row._id, { units: Math.max(0, row.units + units) });
  else if (units > 0) await ctx.db.insert("apiUsage", { api: "youtube", day, scope, units });
}

// Holds the most an add can cost BEFORE any call to YouTube, in one transaction, so parallel adds can't overshoot.
export const reserveYoutube = internalMutation({
  args: { userId: v.id("users"), units: v.number() },
  handler: async (ctx, { userId, units }) => {
    const day = dayKey(Date.now(), YOUTUBE_QUOTA_TIME_ZONE);
    const [all, user] = await Promise.all([usageRow(ctx, day, "all"), usageRow(ctx, day, userId)]);
    const problem = youtubeBudgetProblem({ all: all?.units ?? 0, user: user?.units ?? 0 }, units);
    if (problem) return { ok: false as const, message: problem };
    await addUnits(ctx, day, "all", units);
    await addUnits(ctx, day, userId, units);
    return { ok: true as const, day };
  },
});

// Gives back what an add reserved but didn't use. If an add crashes nothing is returned: it errs toward counting more.
export const refundYoutube = internalMutation({
  args: { userId: v.id("users"), day: v.string(), units: v.number() },
  handler: async (ctx, { userId, day, units }) => {
    if (units <= 0) return;
    await addUnits(ctx, day, "all", -units);
    await addUnits(ctx, day, userId, -units);
  },
});

// A YouTube playlist link → a folder with its videos (up to 200). Uses the YouTube Data API on the server.
export const addPlaylist = action({
  args: { url: v.string(), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { url, folderId }): Promise<AddPlaylistResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, message: "Please log in first." };
    const link = parseLink(url);
    if (link?.kind !== "playlist") return { ok: false, message: "That doesn't look like a YouTube playlist link." };
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return { ok: false, message: "Playlists aren't switched on yet (the YouTube key is missing)." };
    const reserved = await ctx.runMutation(internal.links.reserveYoutube, { userId, units: PLAYLIST_MAX_UNITS });
    if (!reserved.ok) return { ok: false, message: reserved.message };
    let used = 0;
    const get = async (path: string, params: Record<string, string>) => {
      used++; // every list call costs 1 unit, whatever the answer
      const q = new URLSearchParams({ ...params, key });
      const res = await fetch(`${YOUTUBE_API}/${path}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
    };
    try {
      const info = await get("playlists", { part: "snippet", id: link.listId, maxResults: "1" });
      const snippet = (info.body.items as { snippet?: { title?: string } }[] | undefined)?.[0]?.snippet;
      if (info.status !== 200) {
        console.error("[links] playlist lookup failed", info.status);
        return { ok: false, message: "We couldn't reach YouTube just now. Try again." };
      }
      if (!snippet) return { ok: false, message: "We couldn't find that playlist. It may be private." };
      const videos: PlaylistVideo[] = [];
      let hidden = 0;
      let pageToken: string | undefined;
      let more = false;
      do {
        const page = await get("playlistItems", { part: "snippet,status", playlistId: link.listId, maxResults: "50", ...(pageToken ? { pageToken } : {}) });
        if (page.status !== 200) return { ok: false, message: "We couldn't read that playlist. It may be private." };
        const parsed = playlistPageVideos(page.body);
        for (const video of parsed.videos) if (!videos.some((x) => x.videoId === video.videoId)) videos.push(video);
        hidden += parsed.hidden;
        pageToken = parsed.next;
        more = !!pageToken && videos.length >= MAX_PLAYLIST_VIDEOS;
      } while (pageToken && videos.length < MAX_PLAYLIST_VIDEOS);
      const capped = more || videos.length > MAX_PLAYLIST_VIDEOS;
      const kept = videos.slice(0, MAX_PLAYLIST_VIDEOS);
      if (!kept.length) return { ok: false, message: "This playlist has no videos we can show." };
      const saved = await ctx.runMutation(internal.links.savePlaylist, { userId, listId: link.listId, name: snippet.title ?? "YouTube playlist", parentId: folderId, videos: kept });
      return { ok: true, ...saved, hidden, capped };
    } catch (err) {
      console.error("[links] playlist failed", err);
      const message = err instanceof ConvexError && typeof err.data === "string" ? err.data : "We couldn't add that playlist just now. Try again.";
      return { ok: false, message };
    } finally {
      await ctx.runMutation(internal.links.refundYoutube, { userId, day: reserved.day, units: PLAYLIST_MAX_UNITS - used });
    }
  },
});

// Can this article's original page be shown in a frame here? Looks only at response headers, follows at most three
// redirects, and refuses anything that isn't a public web host. Answers yes/no; nothing from the page is returned.
export const canEmbed = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }): Promise<boolean> => {
    const doc = await ctx.runQuery(api.documents.get, { documentId });
    if (!doc?.sourceUrl || doc.sourceType !== "article") return false;
    try {
      let url = new URL(doc.sourceUrl);
      for (let hop = 0; hop < 4; hop++) {
        if (url.protocol !== "https:" || !isPublicHost(url.hostname)) return false;
        const res = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8000) });
        await res.body?.cancel().catch(() => {});
        const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
        if (!next) return res.ok && allowsFraming({ xFrameOptions: res.headers.get("x-frame-options"), csp: res.headers.get("content-security-policy") });
        url = new URL(next, url);
      }
    } catch {
      /* unreachable: treat as not embeddable, the reader can still open it in a new tab */
    }
    return false;
  },
});

// The text of an article, EPUB, Word or PowerPoint file for the reader, in order. Owner only.
export const blocks = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.sourceType === "pdf" || doc.sourceType === "video") return [];
    const rows = await ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_TEXT_BLOCKS);
    return rows.map((r) => ({ page: r.locator.page, text: r.text }));
  },
});
