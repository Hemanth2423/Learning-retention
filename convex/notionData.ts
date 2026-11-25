import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOwnDocument, requireUser } from "./helpers";

const STATE_TTL = 10 * 60 * 1000;

function integration(ctx: Pick<QueryCtx, "db">, userId: Id<"users">) {
  return ctx.db.query("integrations").withIndex("by_user_provider", (q) =>
    q.eq("userId", userId).eq("provider", "notion")).unique();
}

function target(ctx: Pick<QueryCtx, "db">, documentId: Id<"documents">) {
  return ctx.db.query("exportTargets").withIndex("by_document_provider", (q) =>
    q.eq("documentId", documentId).eq("provider", "notion")).unique();
}

export const connection = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const row = await integration(ctx, userId);
    return { connected: Boolean(row), workspaceName: row?.accountName ?? null };
  },
});

export const savedTarget = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const userId = await requireUser(ctx);
    if (!await getOwnDocument(ctx, userId, documentId)) return null;
    const row = await target(ctx, documentId);
    return row?.url ? { url: row.url, lastSentAt: row.lastSentAt } : null;
  },
});

export const connectionFor = internalQuery({
  args: { userId: v.id("users") },
  handler: (ctx, { userId }) => integration(ctx, userId),
});

export const bookTarget = internalQuery({
  args: { userId: v.id("users"), documentId: v.id("documents") },
  handler: async (ctx, { userId, documentId }) => {
    if (!await getOwnDocument(ctx, userId, documentId)) throw new Error("Book not found.");
    return target(ctx, documentId);
  },
});

export const exportedPageIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const books = await ctx.db.query("documents").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const targets = await Promise.all(books.map((book) => target(ctx, book._id)));
    return targets.flatMap((row) => (row?.remoteId ? [row.remoteId] : []));
  },
});

export const expireState = internalMutation({
  args: { id: v.id("oauthStates") },
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});

export const begin = internalMutation({
  args: { state: v.string(), userId: v.id("users"), documentId: v.id("documents") },
  handler: async (ctx, { state, userId, documentId }) => {
    if (!await getOwnDocument(ctx, userId, documentId)) throw new Error("Book not found.");
    const id = await ctx.db.insert("oauthStates", {
      state, userId, provider: "notion", returnTo: `/read/${documentId}?export=notion`,
    });
    await ctx.scheduler.runAfter(STATE_TTL, internal.notionData.expireState, { id });
  },
});

export const consumeState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, { state }) => {
    const row = await ctx.db.query("oauthStates").withIndex("by_state", (q) => q.eq("state", state)).unique();
    if (!row || row.provider !== "notion") return null;
    await ctx.db.delete(row._id);
    return Date.now() - row._creationTime < STATE_TTL ? row : null;
  },
});

export const storeConnection = internalMutation({
  args: {
    userId: v.id("users"), accessToken: v.string(), refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()), accountName: v.string(),
  },
  handler: async (ctx, { userId, ...values }) => {
    const row = await integration(ctx, userId);
    if (row) await ctx.db.patch(row._id, values);
    else await ctx.db.insert("integrations", { userId, provider: "notion", ...values });
  },
});

export const forgetConnection = internalMutation({
  args: { userId: v.id("users"), accessToken: v.string() },
  handler: async (ctx, { userId, accessToken }) => {
    const row = await integration(ctx, userId);
    if (row?.accessToken === accessToken) await ctx.db.delete(row._id);
  },
});

export const claimTarget = internalMutation({
  args: { userId: v.id("users"), documentId: v.id("documents"), parentId: v.string() },
  handler: async (ctx, values) => {
    if (!await getOwnDocument(ctx, values.userId, values.documentId)) throw new Error("Book not found.");
    if (await target(ctx, values.documentId)) return null;
    return ctx.db.insert("exportTargets", {
      ...values, provider: "notion", remoteId: "", url: "", lastSentAt: 0,
    });
  },
});

export const saveTarget = internalMutation({
  args: { id: v.id("exportTargets"), remoteId: v.string(), url: v.string(), lastSentAt: v.number() },
  handler: async (ctx, { id, ...values }) => {
    await ctx.db.patch(id, values);
  },
});

export const forgetTarget = internalMutation({
  args: { id: v.id("exportTargets") },
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.delete(id);
  },
});
