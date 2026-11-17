import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { chapterRanges } from "./chapters";
import { getOwnDocument, requireUser } from "./helpers";
import { isEmptyNote, validateNote, validateNoteImage } from "./reflectionRules";

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

    if (isEmptyNote(plainText, content)) {
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

// Images in notes: the browser uploads the file, then attaches it to the book. The note stores the returned link.
export const imageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachImage = mutation({
  args: { documentId: v.id("documents"), storageId: v.id("_storage") },
  handler: async (ctx, { documentId, storageId }) => {
    const userId = await requireUser(ctx);
    const doc = await getOwnDocument(ctx, userId, documentId);
    const meta = await ctx.db.system.get(storageId);
    const problem = !doc ? "We couldn't find that book." : validateNoteImage(meta);
    if (problem) {
      // Return (don't throw) so the delete isn't rolled back.
      await ctx.storage.delete(storageId).catch(() => {});
      return { ok: false as const, message: problem };
    }
    await ctx.db.insert("noteImages", { userId, documentId, storageId });
    const url = await ctx.storage.getUrl(storageId);
    return url ? { ok: true as const, url } : { ok: false as const, message: "That image didn't upload. Try again." };
  },
});
