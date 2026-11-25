import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import {
  canHaveSubfolder,
  cleanEmoji,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS,
  MAX_MOVE_AT_ONCE,
  moveFolderProblem,
  nextFolderColour,
  normalizeFolderName,
  uniqueFolderName,
  validateFolderName,
} from "./folderRules";
import { requireUser } from "./helpers";

// Library folders (ADRs 016, 017). A folder belongs to one reader, holds any kind of item and can sit inside another
// folder (4 levels). An item is in at most one folder. Deleting a folder never deletes items: its items and
// subfolders move up one level.

const mine = (ctx: QueryCtx, userId: Id<"users">) => ctx.db.query("folders").withIndex("by_user", (q) => q.eq("userId", userId)).take(MAX_FOLDERS + 1);
const siblingNames = (all: { _id: string; name: string; parentId?: string }[], parentId: string | null, except?: string) =>
  all.filter((f) => (f.parentId ?? null) === parentId && f._id !== except).map((f) => f.name);

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

async function fileItems(ctx: MutationCtx, userId: Id<"users">, documentIds: Id<"documents">[], folderId: Id<"folders"> | undefined) {
  if (documentIds.length > MAX_MOVE_AT_ONCE) throw new ConvexError(`Move up to ${MAX_MOVE_AT_ONCE} items at a time.`);
  const docs = await Promise.all(documentIds.map((id) => ctx.db.get(id)));
  if (docs.some((d) => !d || d.userId !== userId)) throw new ConvexError("We couldn't find one of those items.");
  for (const d of docs) await ctx.db.patch(d!._id, { folderId });
}

// Makes a folder (used directly and by playlists). Throws a readable error if the name or place isn't allowed.
export async function insertFolder(ctx: MutationCtx, userId: Id<"users">, name: string, emoji?: string, parentId?: Id<"folders">) {
  const existing = await mine(ctx, userId);
  if (existing.length >= MAX_FOLDERS) throw new ConvexError(`You can have up to ${MAX_FOLDERS} folders.`);
  if (parentId) {
    if (!existing.some((f) => f._id === parentId)) throw new ConvexError("We couldn't find that folder.");
    if (!canHaveSubfolder(existing, parentId)) throw new ConvexError(`Folders can go ${MAX_FOLDER_DEPTH} levels deep.`);
  }
  const problem = validateFolderName(name, siblingNames(existing, parentId ?? null));
  if (problem) throw new ConvexError(problem);
  return await ctx.db.insert("folders", { userId, name: normalizeFolderName(name), colour: nextFolderColour(existing.length), emoji: cleanEmoji(emoji), parentId });
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    // Alphabetical, so a folder keeps its place (also after Undo of a delete).
    return (await mine(ctx, userId))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .map((f) => ({ _id: f._id, name: f.name, colour: f.colour, emoji: f.emoji, parentId: f.parentId ?? null }));
  },
});

// Create a folder, optionally inside another and with items already chosen (the New folder pop-up): all or nothing.
export const create = mutation({
  args: { name: v.string(), emoji: v.optional(v.string()), parentId: v.optional(v.id("folders")), documentIds: v.optional(v.array(v.id("documents"))) },
  handler: async (ctx, { name, emoji, parentId, documentIds }) => {
    const userId = await requireUser(ctx);
    const id = await insertFolder(ctx, userId, name, emoji, parentId);
    if (documentIds?.length) await fileItems(ctx, userId, documentIds, id);
    return id;
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    const userId = await requireUser(ctx);
    const folder = await ownFolder(ctx, userId, folderId);
    if (!folder) throw new ConvexError("We couldn't find that folder.");
    const problem = validateFolderName(name, siblingNames(await mine(ctx, userId), folder.parentId ?? null, folderId));
    if (problem) throw new ConvexError(problem);
    await ctx.db.patch(folderId, { name: normalizeFolderName(name) });
  },
});

// Puts a folder inside another (or at the top level with null). Refuses cycles, too-deep trees and clashing names.
export const moveFolder = mutation({
  args: { folderId: v.id("folders"), parentId: v.union(v.id("folders"), v.null()) },
  handler: async (ctx, { folderId, parentId }) => {
    const userId = await requireUser(ctx);
    const folder = await ownFolder(ctx, userId, folderId);
    if (!folder) throw new ConvexError("We couldn't find that folder.");
    if (parentId && !(await ownFolder(ctx, userId, parentId))) throw new ConvexError("We couldn't find that folder.");
    const all = await mine(ctx, userId);
    const problem = moveFolderProblem(all, folderId, parentId) ?? validateFolderName(folder.name, siblingNames(all, parentId, folderId));
    if (problem) throw new ConvexError(problem);
    await ctx.db.patch(folderId, { parentId: parentId ?? undefined });
  },
});

// Deletes the folder only. Its items and subfolders move up one level; what moved comes back so Undo can restore it.
export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const userId = await requireUser(ctx);
    const folder = await ownFolder(ctx, userId, folderId);
    if (!folder) return { moved: [] as Id<"documents">[], children: [] as { id: Id<"folders">; name: string }[], parentId: null };
    const items = await ctx.db.query("documents").withIndex("by_folder", (q) => q.eq("folderId", folderId)).collect();
    const moved: Id<"documents">[] = [];
    for (const d of items) {
      if (d.userId !== userId) continue; // can't happen (folders are owner-only), but never touch others' items
      await ctx.db.patch(d._id, { folderId: folder.parentId });
      moved.push(d._id);
    }
    const all = await mine(ctx, userId);
    const names = siblingNames(all, folder.parentId ?? null, folderId);
    const children: { id: Id<"folders">; name: string }[] = [];
    for (const c of all.filter((f) => f.parentId === folderId)) {
      const name = uniqueFolderName(c.name, names);
      names.push(name);
      await ctx.db.patch(c._id, { parentId: folder.parentId, name });
      children.push({ id: c._id, name: c.name });
    }
    await ctx.db.delete(folderId);
    return { moved, children, parentId: folder.parentId ?? null };
  },
});

// Undo of a delete: the folder comes back in its place, with its items and subfolders (under their old names).
export const restore = mutation({
  args: {
    name: v.string(),
    emoji: v.string(),
    parentId: v.union(v.id("folders"), v.null()),
    documentIds: v.array(v.id("documents")),
    children: v.array(v.object({ id: v.id("folders"), name: v.string() })),
  },
  handler: async (ctx, { name, emoji, parentId, documentIds, children }) => {
    const userId = await requireUser(ctx);
    const parent = parentId && (await ownFolder(ctx, userId, parentId)) ? parentId : undefined;
    const id = await insertFolder(ctx, userId, name, emoji, parent);
    await fileItems(ctx, userId, documentIds, id);
    for (const c of children) {
      const child = await ownFolder(ctx, userId, c.id);
      if (child) await ctx.db.patch(c.id, { parentId: id, name: normalizeFolderName(c.name) });
    }
    return id;
  },
});

// Files items into a folder (or none, with folderId null). All-or-nothing: every item must be the reader's.
export const moveItems = mutation({
  args: { documentIds: v.array(v.id("documents")), folderId: v.union(v.id("folders"), v.null()) },
  handler: async (ctx, { documentIds, folderId }) => {
    const userId = await requireUser(ctx);
    if (documentIds.length === 0) return { moved: 0 };
    if (folderId && !(await ownFolder(ctx, userId, folderId))) throw new ConvexError("We couldn't find that folder.");
    await fileItems(ctx, userId, documentIds, folderId ?? undefined);
    return { moved: documentIds.length };
  },
});
