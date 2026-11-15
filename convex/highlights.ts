import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwnDocument, requireUser } from "./helpers";
import {
  firstPage,
  MAX_HIGHLIGHTS_PER_DOCUMENT,
  normalizeText,
  validateComment,
  validateHighlight,
} from "./highlightRules";

const segments = v.array(
  v.object({ page: v.number(), rects: v.array(v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() })) })
);

export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    if (!(await getOwnDocument(ctx, userId, documentId))) return [];
    return await ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_HIGHLIGHTS_PER_DOCUMENT);
  },
});

export const add = mutation({
  args: { documentId: v.id("documents"), text: v.string(), segments, comment: v.optional(v.string()) },
  handler: async (ctx, { documentId, text, segments, comment }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "ready") throw new ConvexError("We couldn't find that book.");
    if (doc.hasText === false) throw new ConvexError("Highlights aren't available for scanned PDFs.");
    const problem = validateHighlight({ text, segments, pageCount: doc.pageCount ?? 0 }) ?? (comment ? validateComment(comment) : undefined);
    if (problem) throw new ConvexError(problem);
    const existing = await ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", documentId)).take(MAX_HIGHLIGHTS_PER_DOCUMENT);
    if (existing.length >= MAX_HIGHLIGHTS_PER_DOCUMENT) throw new ConvexError("This book has reached the highlight limit.");
    return await ctx.db.insert("highlights", {
      userId,
      documentId,
      // The page comes from the boxes, never from a separate value the browser could get wrong.
      locator: { kind: "pdf", page: firstPage(segments) },
      text: normalizeText(text),
      segments,
      comment: comment?.trim() || undefined,
    });
  },
});

// An empty comment removes it.
export const setComment = mutation({
  args: { highlightId: v.id("highlights"), comment: v.string() },
  handler: async (ctx, { highlightId, comment }) => {
    const userId = await requireUser(ctx);
    const h = await ctx.db.get(highlightId);
    if (!h || h.userId !== userId) return;
    const problem = validateComment(comment);
    if (problem) throw new ConvexError(problem);
    await ctx.db.patch(highlightId, { comment: comment.trim() || undefined });
  },
});

export const remove = mutation({
  args: { highlightId: v.id("highlights") },
  handler: async (ctx, { highlightId }) => {
    const userId = await requireUser(ctx);
    const h = await ctx.db.get(highlightId);
    if (!h || h.userId !== userId) return;
    await ctx.db.delete(highlightId);
  },
});
