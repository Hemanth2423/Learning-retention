import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, validateCover, validateTitle } from "./documentRules";
import { folderForNewItem } from "./folders";
import { getOwnDocument, requireUser } from "./helpers";
import { KIND_LABEL, kindOfFile, MAX_TEXT_BLOCKS, TextKind, validateBlocks, validateSections } from "./textSourceRules";

// EPUB, Word and PowerPoint files are read in the browser (no AI, no server parsing) and arrive here as text blocks.
// The server checks everything again: the file, the order and size of the blocks, and that the contents point
// inside the text. Flow: begin → addBlocks (in batches) → finish, or fail if the browser couldn't read the file.

const kindArg = v.union(v.literal("epub"), v.literal("word"), v.literal("powerpoint"));
const section = v.object({ key: v.string(), title: v.string(), level: v.number(), locator: v.object({ kind: v.literal("text"), page: v.number() }) });

export const begin = mutation({
  args: { fileId: v.id("_storage"), fileName: v.string(), kind: kindArg, title: v.string(), folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { fileId, fileName, kind, title, folderId }) => {
    const userId = await requireUser(ctx);
    const meta = await ctx.db.system.get(fileId);
    const label = KIND_LABEL[kind];
    const problem =
      !meta || meta.size === 0
        ? "The upload didn't go through. Try again."
        : meta.size > MAX_UPLOAD_BYTES
          ? `That ${label} is over ${MAX_UPLOAD_MB} MB. Try a smaller file.`
          : kindOfFile(fileName) !== kind
            ? "That file doesn't match its type."
            : validateTitle(title);
    if (problem) {
      // Return (don't throw): a thrown error would roll back this delete and leave the file in storage.
      await ctx.storage.delete(fileId).catch(() => {});
      return { ok: false as const, message: problem };
    }
    const documentId = await ctx.db.insert("documents", {
      userId,
      title: title.trim(),
      sourceType: kind as TextKind,
      fileId,
      folderId: await folderForNewItem(ctx, userId, folderId),
      status: "processing",
      statusMessage: `Reading your ${label} file…`,
    });
    return { ok: true as const, documentId };
  },
});

export const addBlocks = mutation({
  args: { documentId: v.id("documents"), startIndex: v.number(), blocks: v.array(v.string()) },
  handler: async (ctx, { documentId, startIndex, blocks }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "processing" || doc.sourceType === "pdf" || doc.sourceType === "article" || doc.sourceType === "video") return { ok: false as const, message: "That file isn't being added." };
    const existing = (await ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_TEXT_BLOCKS + 1)).length;
    const problem = validateBlocks(blocks, startIndex, existing);
    if (problem) return { ok: false as const, message: problem };
    for (let i = 0; i < blocks.length; i++) {
      const index = startIndex + i;
      await ctx.db.insert("chunks", { documentId, userId, index, text: blocks[i], locator: { kind: "text", page: index + 1 } });
    }
    return { ok: true as const };
  },
});

export const finish = mutation({
  args: { documentId: v.id("documents"), sections: v.array(section), coverId: v.optional(v.id("_storage")) },
  handler: async (ctx, { documentId, sections, coverId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "processing" || !["epub", "word", "powerpoint"].includes(doc.sourceType)) return { ok: false as const, message: "That file isn't being added." };
    const count = (await ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_TEXT_BLOCKS + 1)).length;
    const problem = count === 0 ? "We couldn't find any text in this file." : validateSections(sections, count);
    if (problem) return { ok: false as const, message: problem };
    // An EPUB's own cover (optional): checked like any cover; a bad one is dropped, the book is still added.
    let cover: typeof coverId = undefined;
    if (coverId) {
      const meta = await ctx.db.system.get(coverId);
      if (validateCover(meta ? { contentType: meta.contentType, size: meta.size } : null)) await ctx.storage.delete(coverId).catch(() => {});
      else cover = coverId;
    }
    await ctx.db.patch(documentId, {
      status: "ready",
      statusMessage: undefined,
      pageCount: count,
      hasText: true,
      sections,
      ...(cover ? { coverId: cover } : { coverChecked: true }),
    });
    return { ok: true as const };
  },
});

// The browser couldn't read the file: keep a failed entry with the reason (like a PDF that can't be read),
// and delete the file and any text that arrived.
export const fail = mutation({
  args: { documentId: v.id("documents"), message: v.string() },
  handler: async (ctx, { documentId, message }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "processing") return;
    const chunks = await ctx.db.query("chunks").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_TEXT_BLOCKS + 1);
    for (const c of chunks) await ctx.db.delete(c._id);
    if (doc.fileId) await ctx.storage.delete(doc.fileId).catch(() => {});
    await ctx.db.patch(documentId, { status: "failed", statusMessage: message.slice(0, 300), fileId: undefined });
  },
});
