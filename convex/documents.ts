import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "./documentRules";
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
  args: { documentId: v.id("documents"), page: v.number() },
  handler: async (ctx, { documentId, page }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || !doc.pageCount) return;
    if (!Number.isInteger(page) || page < 1 || page > doc.pageCount) return;
    await ctx.db.patch(documentId, { lastLocator: { kind: "pdf", page } });
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
