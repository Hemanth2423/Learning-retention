import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { chapterRanges } from "./chapters";
import { bookProgress, markPages, MAX_SEEN_PER_SAVE } from "./readingRules";
import { libraryOrder, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateTitle } from "./documentRules";
import { getOwnDocument, requireUser } from "./helpers";
import { locator } from "./locators";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Called after the browser has uploaded the file. Re-checks size on the server (the browser check can be skipped),
// then starts the (non-AI) preparation.
export const create = mutation({
  args: { fileId: v.id("_storage"), fileName: v.string() },
  handler: async (ctx, { fileId, fileName }) => {
    const userId = await requireUser(ctx);
    const meta = await ctx.db.system.get(fileId); // size of the uploaded file
    if (!meta || meta.size === 0 || meta.size > MAX_UPLOAD_BYTES) {
      // Return (don't throw): a thrown error would roll back this delete and leave the file in storage.
      await ctx.storage.delete(fileId);
      return { ok: false as const, message: `That PDF is over ${MAX_UPLOAD_MB} MB. Try a smaller file.` };
    }
    const documentId = await ctx.db.insert("documents", {
      userId,
      title: fileName.replace(/\.pdf$/i, "").slice(0, 120) || "Untitled",
      sourceType: "pdf",
      fileId,
      status: "processing",
      statusMessage: "Preparing your book…",
    });
    await ctx.scheduler.runAfter(0, internal.ingest.run, { documentId, fileName });
    return { ok: true as const, documentId };
  },
});

export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc) return null;
    const { fileId: _fileId, ...rest } = doc;
    return rest;
  },
});

// A short-lived link the reader uses to load the PDF. The storage id itself never reaches the browser.
export const fileUrl = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "ready") return null;
    return await ctx.storage.getUrl(doc.fileId);
  },
});

// Remembers where the reader left off.
export const saveProgress = mutation({
  // `seen`: pages that were on screen long enough to count as read since the last save.
  args: { documentId: v.id("documents"), page: v.number(), seen: v.optional(v.array(v.number())) },
  handler: async (ctx, { documentId, page, seen }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || !doc.pageCount) return;
    if (!Number.isInteger(page) || page < 1 || page > doc.pageCount) return;
    const patch: { lastLocator: { kind: "pdf"; page: number }; lastReadAt: number; pagesSeen?: string } = {
      lastLocator: { kind: "pdf", page },
      lastReadAt: Date.now(),
    };
    if (seen?.length) patch.pagesSeen = markPages(doc.pagesSeen, doc.pageCount, seen.slice(0, MAX_SEEN_PER_SAVE));
    await ctx.db.patch(documentId, patch);
  },
});

// The library: every book the reader has added, most recently read first.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docs = await ctx.db.query("documents").withIndex("by_user", (q) => q.eq("userId", userId)).take(500);
    return libraryOrder(docs).map((d) => {
      const page = d.lastLocator?.page ?? null;
      const ranges = chapterRanges(d.sections ?? [], d.pageCount ?? 0);
      const at = page === null ? -1 : ranges.findIndex((r) => page >= r.startPage && page <= r.endPage);
      return {
        _id: d._id,
        title: d.title,
        status: d.status,
        statusMessage: d.statusMessage,
        pageCount: d.pageCount ?? 0,
        page,
        chapterNumber: at >= 0 ? at + 1 : null,
        chapterTitle: at >= 0 ? ranges[at].title : null,
        progress: bookProgress(d.pagesSeen, d.pageCount ?? 0),
        lastReadAt: d.lastReadAt ?? null,
      };
    });
  },
});

export const rename = mutation({
  args: { documentId: v.id("documents"), title: v.string() },
  handler: async (ctx, { documentId, title }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc) return;
    const problem = validateTitle(title);
    if (problem) throw new ConvexError(problem);
    await ctx.db.patch(documentId, { title: title.trim() });
  },
});

// Removes a book from the library. The book disappears at once; its file and everything made from it
// (pages, highlights, notes, chat) are deleted in the background in batches.
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc) return;
    await ctx.db.delete(documentId);
    await ctx.scheduler.runAfter(0, internal.documents.purge, { documentId, fileId: doc.fileId });
  },
});

const PURGE_BATCH = 400;

export const purge = internalMutation({
  args: { documentId: v.id("documents"), fileId: v.optional(v.id("_storage")) },
  handler: async (ctx, { documentId, fileId }) => {
    if (fileId) await ctx.storage.delete(fileId).catch(() => {});
    const batches = await Promise.all([
      ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("reflections").withIndex("by_document_section", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("chatMessages").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("noteImages").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("quizzes").withIndex("by_document_chapter", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("quizAttempts").withIndex("by_document_chapter", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
    ]);
    const rows = batches.flat();
    for (const r of rows) {
      if ("storageId" in r) await ctx.storage.delete(r.storageId).catch(() => {}); // the image file itself
      await ctx.db.delete(r._id);
    }
    // Anything left over goes in the next batch.
    if (batches.some((b) => b.length === PURGE_BATCH)) await ctx.scheduler.runAfter(0, internal.documents.purge, { documentId });
  },
});

// The most recently added finished book, for the "Continue reading" link.
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docs = await ctx.db.query("documents").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(10);
    const ready = docs.find((d) => d.status === "ready");
    return ready ? { _id: ready._id, title: ready.title } : null;
  },
});

// "Try again" after a failed preparation: removes the leftover row.
export const discard = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "failed") return;
    await ctx.db.delete(documentId);
  },
});

// ---- Called by the ingest action only ----

export const getForIngest = internalMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const doc = await ctx.db.get(documentId);
    return doc ? { fileId: doc.fileId, userId: doc.userId } : null;
  },
});

export const saveChunks = internalMutation({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    startIndex: v.number(),
    pages: v.array(v.string()),
  },
  handler: async (ctx, { documentId, userId, startIndex, pages }) => {
    for (let i = 0; i < pages.length; i++) {
      const index = startIndex + i;
      await ctx.db.insert("chunks", { documentId, userId, index, text: pages[i], locator: { kind: "pdf", page: index + 1 } });
    }
  },
});

export const markReady = internalMutation({
  args: {
    documentId: v.id("documents"),
    title: v.string(),
    pageCount: v.number(),
    hasText: v.boolean(),
    sections: v.array(v.object({ key: v.string(), title: v.string(), level: v.number(), locator })),
  },
  handler: async (ctx, { documentId, ...fields }) => {
    await ctx.db.patch(documentId, { ...fields, status: "ready", statusMessage: undefined });
  },
});

// Failed preparation leaves no half-made document: the file and any pages are removed; only the message stays
// so the page can show it.
export const markFailed = internalMutation({
  args: { documentId: v.id("documents"), message: v.string() },
  handler: async (ctx, { documentId, message }) => {
    const doc = await ctx.db.get(documentId);
    if (!doc) return;
    const chunks = await ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).collect();
    for (const c of chunks) await ctx.db.delete(c._id);
    await ctx.storage.delete(doc.fileId).catch(() => {});
    await ctx.db.patch(documentId, { status: "failed", statusMessage: message });
  },
});
