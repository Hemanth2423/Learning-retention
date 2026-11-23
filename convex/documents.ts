import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { chapterRanges } from "./chapters";
import { bookProgress, chapterProgress, markPages, MAX_SEEN_PER_SAVE } from "./readingRules";
import { libraryOrder, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateCover, validateTitle } from "./documentRules";
import { getOwnDocument, requireUser } from "./helpers";
import { locator } from "./locators";
import { kindOfFile } from "./textSourceRules";
import { folderForNewItem } from "./folders";
import { awardXp } from "./xp";
import { awardKey, XP } from "./xpRules";
import { purgeConcepts } from "./concepts";

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
  args: { fileId: v.id("_storage"), fileName: v.string(), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { fileId, fileName, folderId }) => {
    const userId = await requireUser(ctx);
    const meta = await ctx.db.system.get(fileId); // size of the uploaded file
    if (kindOfFile(fileName) !== "pdf") {
      // EPUB, Word and PowerPoint go through textSources.ts.
      await ctx.storage.delete(fileId);
      return { ok: false as const, message: "That file isn't a PDF." };
    }
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
      folderId: await folderForNewItem(ctx, userId, folderId),
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
    const { fileId: _fileId, coverId, ...rest } = doc;
    return { ...rest, coverUrl: coverId ? await ctx.storage.getUrl(coverId) : null };
  },
});

// A short-lived link the reader uses to load the PDF. The storage id itself never reaches the browser.
export const fileUrl = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "ready" || !doc.fileId) return null;
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
    const patch: { lastLocator: { kind: "pdf" | "text"; page: number }; lastReadAt: number; pagesSeen?: string } = {
      lastLocator: { kind: doc.sourceType === "pdf" ? "pdf" : "text", page },
      lastReadAt: Date.now(),
    };
    if (seen?.length) patch.pagesSeen = markPages(doc.pagesSeen, doc.pageCount, seen.slice(0, MAX_SEEN_PER_SAVE));
    await ctx.db.patch(documentId, patch);
    // 10 XP for each chapter read in full (paid once per chapter). Books only (PDF, EPUB).
    if (patch.pagesSeen && patch.pagesSeen !== doc.pagesSeen && (doc.sourceType === "pdf" || doc.sourceType === "epub")) {
      const read = chapterProgress(chapterRanges(doc.sections ?? [], doc.pageCount), patch.pagesSeen).filter((c) => c.read);
      await awardXp(ctx, userId, read.map((c) => ({ key: awardKey.read(documentId, c.key), xp: XP.read })));
    }
  },
});

// The library: every book the reader has added, most recently read first.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const docs = await ctx.db.query("documents").withIndex("by_user", (q) => q.eq("userId", userId)).take(500);
    return await Promise.all(libraryOrder(docs).map(async (d) => {
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
        progress: d.sourceType === "pdf" || d.sourceType === "epub" ? bookProgress(d.pagesSeen, d.pageCount ?? 0) : 0,
        sourceType: d.sourceType,
        siteName: d.siteName ?? null,
        imageUrl: d.imageUrl ?? null,
        coverUrl: d.coverId ? await ctx.storage.getUrl(d.coverId) : null,
        needsCover: d.sourceType === "pdf" && d.status === "ready" && !d.coverId && !d.coverChecked,
        folderId: d.folderId ?? null,
        lastReadAt: d.lastReadAt ?? null,
      };
    }));
  },
});

// Saves a cover image the browser made (a PDF's first page). The image is checked here, not trusted.
// Returns instead of throwing on a bad image, so the delete of the uploaded file isn't rolled back.
export const setCover = mutation({
  args: { documentId: v.id("documents"), coverId: v.id("_storage") },
  handler: async (ctx, { documentId, coverId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    const meta = await ctx.db.system.get(coverId);
    const problem = !doc ? "That book isn't in your library." : validateCover(meta ? { contentType: meta.contentType, size: meta.size } : null);
    if (problem) {
      await ctx.storage.delete(coverId).catch(() => {});
      return { ok: false as const, message: problem };
    }
    if (doc!.coverId) await ctx.storage.delete(doc!.coverId).catch(() => {});
    await ctx.db.patch(documentId, { coverId });
    return { ok: true as const };
  },
});

// Page 1 isn't a cover (mostly white: a text or title page). Remember that, so it isn't drawn again.
export const skipCover = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (doc && !doc.coverId) await ctx.db.patch(documentId, { coverChecked: true });
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
    await ctx.scheduler.runAfter(0, internal.documents.purge, { documentId, fileId: doc.fileId, coverId: doc.coverId });
  },
});

const PURGE_BATCH = 400;

export const purge = internalMutation({
  args: { documentId: v.id("documents"), fileId: v.optional(v.id("_storage")), coverId: v.optional(v.id("_storage")) },
  handler: async (ctx, { documentId, fileId, coverId }) => {
    if (fileId) await ctx.storage.delete(fileId).catch(() => {});
    if (coverId) await ctx.storage.delete(coverId).catch(() => {});
    const batches = await Promise.all([
      ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("reflections").withIndex("by_document_section", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("notes").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("savedQuestions").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("chatMessages").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("noteImages").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("quizzes").withIndex("by_document_chapter", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
      ctx.db.query("quizAttempts").withIndex("by_document_chapter", (q) => q.eq("documentId", documentId)).take(PURGE_BATCH),
    ]);
    const conceptsLeft = await purgeConcepts(ctx, documentId, PURGE_BATCH);
    const rows = batches.flat();
    for (const r of rows) {
      if ("storageId" in r) await ctx.storage.delete(r.storageId).catch(() => {}); // the image file itself
      await ctx.db.delete(r._id);
    }
    // Anything left over goes in the next batch.
    if (conceptsLeft || batches.some((b) => b.length === PURGE_BATCH)) await ctx.scheduler.runAfter(0, internal.documents.purge, { documentId });
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
    if (doc.fileId) await ctx.storage.delete(doc.fileId).catch(() => {});
    await ctx.db.patch(documentId, { status: "failed", statusMessage: message });
  },
});
