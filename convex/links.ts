import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { getOwnDocument, requireUser } from "./helpers";
import { cleanArticleMarkdown, parseLink, readableEnough, siteNameOf, splitArticle, youtubeThumb } from "./linkRules";

// Adding an article or a YouTube video by link (Feature 3, slice 1). All network calls happen here, on the server:
// Firecrawl reads the article once; YouTube oEmbed gives the video's title and channel. Nothing is re-fetched later.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const OEMBED_URL = "https://www.youtube.com/oembed";
const TIMEOUT_MS = 45_000;

export type AddLinkResult =
  | { ok: true; documentId: Id<"documents">; savedAsLink?: boolean; message?: string }
  | { ok: false; message: string; documentId?: Id<"documents"> };

// Step 1: refuse duplicates and reserve the item, in one transaction (two quick clicks can't add it twice).
export const begin = internalMutation({
  args: { userId: v.id("users"), url: v.string(), kind: v.union(v.literal("article"), v.literal("video")), videoId: v.optional(v.string()), title: v.string() },
  handler: async (ctx, { userId, url, kind, videoId, title }): Promise<AddLinkResult> => {
    const existing = await ctx.db.query("documents").withIndex("by_user_source", (q) => q.eq("userId", userId).eq("sourceUrl", url)).first();
    if (existing) return { ok: false, message: "That's already in your library.", documentId: existing._id };
    const documentId = await ctx.db.insert("documents", {
      userId,
      title,
      sourceType: kind,
      sourceUrl: url,
      videoId,
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
  args: { url: v.string() },
  handler: async (ctx, { url }): Promise<AddLinkResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { ok: false, message: "Please log in first." };
    const link = parseLink(url);
    if (!link) return { ok: false, message: "That doesn't look like an article or YouTube link." };

    const placeholder = link.kind === "video" ? "YouTube video" : siteNameOf(link.host);
    const start = await ctx.runMutation(internal.links.begin, { userId, url: link.url, kind: link.kind, videoId: link.kind === "video" ? link.videoId : undefined, title: placeholder });
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
          body: JSON.stringify({ url: link.url, formats: ["markdown"], onlyMainContent: true }),
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

// The article's text for the reader, in order. Owner only.
export const blocks = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.sourceType !== "article") return [];
    const rows = await ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(500);
    return rows.map((r) => ({ page: r.locator.page, text: r.text }));
  },
});
