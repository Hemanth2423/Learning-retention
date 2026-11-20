import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getOwnDocument, requireUser } from "./helpers";
import { validateNoteImage } from "./reflectionRules";

// The Notebook (notebook.ts) now holds notes; this file keeps only images in notes.

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
