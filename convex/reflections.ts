import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { chapterRanges } from "./chapters";
import { getOwnDocument, requireUser } from "./helpers";
import { isEmptyNote, validateNote } from "./reflectionRules";

export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    if (!(await getOwnDocument(ctx, userId, documentId))) return [];
    const rows = await ctx.db.query("reflections").withIndex("by_document_section", (q) => q.eq("documentId", documentId)).take(2000);
    return rows.map((r) => ({ _id: r._id, sectionKey: r.sectionKey, content: r.content, plainText: r.plainText, dismissed: r.dismissed === true }));
  },
});

// One reflection per chapter. Saving an empty note deletes it.
export const save = mutation({
  args: { documentId: v.id("documents"), sectionKey: v.string(), content: v.string(), plainText: v.string() },
  handler: async (ctx, { documentId, sectionKey, content, plainText }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc || doc.status !== "ready") throw new ConvexError("We couldn't find that book.");
    if (!chapterRanges(doc.sections ?? [], doc.pageCount ?? 0).some((c) => c.key === sectionKey)) throw new ConvexError("That chapter doesn't exist.");
    const existing = await ctx.db.query("reflections").withIndex("by_document_section", (q) => q.eq("documentId", documentId).eq("sectionKey", sectionKey)).first();

    if (isEmptyNote(plainText)) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    const problem = validateNote({ content, plainText });
    if (problem) throw new ConvexError(problem);
    if (existing) await ctx.db.patch(existing._id, { content, plainText, dismissed: undefined });
    else await ctx.db.insert("reflections", { userId, documentId, sectionKey, content, plainText });
  },
});

// "Not now" at the end-of-chapter prompt: remembered so the chapter isn't asked about again.
export const dismiss = mutation({
  args: { documentId: v.id("documents"), sectionKey: v.string() },
  handler: async (ctx, { documentId, sectionKey }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    if (!doc) return;
    if (!chapterRanges(doc.sections ?? [], doc.pageCount ?? 0).some((c) => c.key === sectionKey)) return;
    const existing = await ctx.db.query("reflections").withIndex("by_document_section", (q) => q.eq("documentId", documentId).eq("sectionKey", sectionKey)).first();
    if (!existing) await ctx.db.insert("reflections", { userId, documentId, sectionKey, dismissed: true });
  },
});
