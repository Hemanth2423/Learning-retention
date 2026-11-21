import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { cleanEmoji, MAX_FOLDERS, MAX_MOVE_AT_ONCE, nextFolderColour, normalizeFolderName, validateFolderName } from "./folderRules";
import { requireUser } from "./helpers";

// Library folders (ADR 016). A folder belongs to one reader and holds any kind of item; an item is in at most
// one folder (documents.folderId). Deleting a folder never deletes items: they move to "No folder".

const mine = (ctx: QueryCtx, userId: Id<"users">) => ctx.db.query("folders").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_FOLDERS + 1);

async function ownFolder(ctx: QueryCtx, userId: Id<"users">, folderId: Id<"folders">) {
  const f = await ctx.db.get(folderId);
  return f && f.userId === userId ? f : null;
}

// For adding new items straight into a folder: the folder if it's the reader's, else no folder (it may have been
// deleted while a file was uploading; adding shouldn't fail because of that).
export async function folderForNewItem(ctx: QueryCtx, userId: Id<"users">, folderId: Id<"folders"> | undefined) {
  if (!folderId) return undefined;
  return (await ownFolder(ctx, userId, folderId))?._id;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    // Alphabetical, so a folder keeps its place (also after Undo of a delete).
    return (await mine(ctx, userId))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((f) => ({ _id: f._id, name: f.name, colour: f.colour, emoji: f.emoji }));
  },
});

export const create = mutation({
  args: { name: v.string(), emoji: v.optional(v.string()) },
  handler: async (ctx, { name, emoji }) => {
    const userId = await requireUser(ctx);
    const existing = await mine(ctx, userId);
    if (existing.length >= MAX_FOLDERS) throw new ConvexError(`You can have up to ${MAX_FOLDERS} folders.`);
    const problem = validateFolderName(name, existing.map((f) => f.name));
    if (problem) throw new ConvexError(problem);
    return await ctx.db.insert("folders", { userId, name: normalizeFolderName(name), colour: nextFolderColour(existing.length), emoji: cleanEmoji(emoji) });
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    const userId = await requireUser(ctx);
    const folder = await ownFolder(ctx, userId, folderId);
    if (!folder) throw new ConvexError("We couldn't find that folder.");
    const others = (await mine(ctx, userId)).filter((f) => f._id !== folderId).map((f) => f.name);
    const problem = validateFolderName(name, others);
    if (problem) throw new ConvexError(problem);
    await ctx.db.patch(folderId, { name: normalizeFolderName(name) });
  },
});

// Deletes the folder only. Its items move to "No folder"; their ids come back so the browser can offer Undo.
export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const userId = await requireUser(ctx);
    const folder = await ownFolder(ctx, userId, folderId);
    if (!folder) return { moved: [] as Id<"documents">[] };
    const items = await ctx.db.query("documents").withIndex("by_folder", (q) => q.eq("folderId", folderId)).collect();
    const moved: Id<"documents">[] = [];
    for (const d of items) {
      if (d.userId !== userId) continue; // can't happen (folders are owner-only), but never touch others' items
      await ctx.db.patch(d._id, { folderId: undefined });
      moved.push(d._id);
    }
    await ctx.db.delete(folderId);
    return { moved };
  },
});

// Files items into a folder (or none, with folderId null). All-or-nothing: every item must be the reader's.
export const moveItems = mutation({
  args: { documentIds: v.array(v.id("documents")), folderId: v.union(v.id("folders"), v.null()) },
  handler: async (ctx, { documentIds, folderId }) => {
    const userId = await requireUser(ctx);
    if (documentIds.length === 0) return { moved: 0 };
    if (documentIds.length > MAX_MOVE_AT_ONCE) throw new ConvexError(`Move up to ${MAX_MOVE_AT_ONCE} items at a time.`);
    if (folderId && !(await ownFolder(ctx, userId, folderId))) throw new ConvexError("We couldn't find that folder.");
    const docs = await Promise.all(documentIds.map((id) => ctx.db.get(id)));
    if (docs.some((d) => !d || d.userId !== userId)) throw new ConvexError("We couldn't find one of those items.");
    for (const d of docs) await ctx.db.patch(d!._id, { folderId: folderId ?? undefined });
    return { moved: docs.length };
  },
});
