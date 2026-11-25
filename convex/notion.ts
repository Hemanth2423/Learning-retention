import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, httpAction } from "./_generated/server";
import { requireUser } from "./helpers";
import { PAGE_GONE, isAbandonedSend, notebookBlocks, notionBlockBatches } from "./notionRules";

const apiRoot = "https://api.notion.com/v1";
const reconnect = { ok: false as const, message: "Reconnect Notion" };
const unavailable = { ok: false as const, message: "Notion isn’t available. Try again." };
const inProgress = { ok: false as const, message: "A send is already running. Try again in a few minutes." };

class NotionError extends Error {
  constructor(readonly status: number) {
    super(`Notion returned HTTP ${status}`);
  }
}

async function request<T>(path: string, authorization: string, method = "GET", body?: unknown): Promise<T> {
  const options = {
    method,
    headers: { Authorization: authorization, "Notion-Version": "2026-03-11", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let response = await fetch(apiRoot + path, options);
  for (let attempt = 0; response.status === 429 && attempt < 2; attempt++) {
    const header = response.headers.get("Retry-After");
    const delay = header === null ? 1 : Number(header);
    if (!Number.isFinite(delay) || delay < 0 || delay > 60) break;
    await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    response = await fetch(apiRoot + path, options);
  }
  if (!response.ok) throw new NotionError(response.status);
  return response.json() as Promise<T>;
}

function oauthConfiguration() {
  const clientId = process.env.NOTION_CLIENT_ID?.trim();
  const clientSecret = process.env.NOTION_CLIENT_SECRET?.trim();
  const convexSite = process.env.CONVEX_SITE_URL;
  if (!clientId || !clientSecret || !convexSite) return null;
  return { clientId, clientSecret, redirectUri: new URL("/oauth/notion/callback", convexSite).href };
}

export const connect = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }): Promise<{ url: string } | { message: string }> => {
    const userId = await requireUser(ctx);
    const config = oauthConfiguration();
    if (!config || !process.env.SITE_URL) return { message: "Notion isn’t set up yet." };
    const state = crypto.randomUUID();
    await ctx.runMutation(internal.notionData.begin, { state, userId, documentId });
    const url = new URL("https://api.notion.com/v1/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: config.clientId, response_type: "code", owner: "user", redirect_uri: config.redirectUri, state,
    }).toString();
    return { url: url.href };
  },
});

export const callback = httpAction(async (ctx, req) => {
  const params = new URL(req.url).searchParams;
  const state = params.get("state");
  const pending = state && await ctx.runMutation(internal.notionData.consumeState, { state });
  const config = oauthConfiguration();
  const site = process.env.SITE_URL;
  if (!pending || !config || !site) return new Response("Please reconnect Notion from Ingrain.", { status: 400 });

  const destination = new URL(pending.returnTo, site);
  const code = params.get("code");
  if (code && !params.has("error")) {
    try {
      const credentials = new TextEncoder().encode(`${config.clientId}:${config.clientSecret}`);
      const authorization = `Basic ${btoa(String.fromCharCode(...credentials))}`;
      const tokens = await request<{
        access_token: string; refresh_token?: string | null; expires_in?: number | null; workspace_name?: string | null;
      }>("/oauth/token", authorization, "POST", {
        grant_type: "authorization_code", code, redirect_uri: config.redirectUri,
      });
      await ctx.runMutation(internal.notionData.storeConnection, {
        userId: pending.userId, accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : undefined,
        accountName: tokens.workspace_name ?? "Notion",
      });
    } catch (error) {
      const diagnostic = error instanceof NotionError ? `HTTP ${error.status}` : error instanceof Error ? error.name : "Unknown error";
      console.error("Notion OAuth callback failed:", diagnostic);
      destination.searchParams.set("notion", "error");
    }
  } else {
    destination.searchParams.set("notion", "error");
  }
  return Response.redirect(destination, 303);
});

type SearchPage = { id: string; properties: Record<string, { type: string; title?: { plain_text: string }[] }> };
type PageList<T> = { results: T[]; next_cursor: string | null };

export const listPages = action({
  args: {},
  handler: async (ctx): Promise<typeof reconnect | { ok: true; pages: { id: string; title: string }[] }> => {
    const userId = await requireUser(ctx);
    const connection = await ctx.runQuery(internal.notionData.connectionFor, { userId });
    if (!connection) return reconnect;
    // A book's own export page isn't a place to put another book.
    const exported = new Set(await ctx.runQuery(internal.notionData.exportedPageIds, { userId }));
    const pages: { id: string; title: string }[] = [];
    let cursor: string | null = null;
    try {
      do {
        const result: PageList<SearchPage> = await request("/search", `Bearer ${connection.accessToken}`, "POST", {
          filter: { property: "object", value: "page" },
          ...(cursor ? { start_cursor: cursor } : {}),
        });
        for (const page of result.results) {
          if (exported.has(page.id)) continue;
          const title = Object.values(page.properties).find((property) => property.type === "title");
          pages.push({ id: page.id, title: title?.title?.map((part) => part.plain_text).join("") || "Untitled page" });
        }
        cursor = result.next_cursor;
      } while (cursor);
      return { ok: true, pages };
    } catch (error) {
      if (error instanceof NotionError && error.status === 401) {
        await ctx.runMutation(internal.notionData.forgetConnection, { userId, accessToken: connection.accessToken });
        return reconnect;
      }
      return unavailable;
    }
  },
});

async function listBlocks(pageId: string, authorization: string) {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const query = cursor ? `?${new URLSearchParams({ start_cursor: cursor })}` : "";
    const response: PageList<{ id: string }> = await request(`/blocks/${encodeURIComponent(pageId)}/children${query}`, authorization);
    ids.push(...response.results.map(({ id }) => id));
    cursor = response.next_cursor;
  } while (cursor);
  return ids;
}

export const send = action({
  args: { documentId: v.id("documents"), parentId: v.optional(v.string()) },
  handler: async (ctx, { documentId, parentId }): Promise<{ ok: false; message: string } | { ok: true; url: string }> => {
    const userId = await requireUser(ctx);
    let existing = await ctx.runQuery(internal.notionData.bookTarget, { userId, documentId });
    const connection = await ctx.runQuery(internal.notionData.connectionFor, { userId });
    if (!connection) return reconnect;
    if (existing && !existing.remoteId) {
      if (!isAbandonedSend(existing._creationTime, Date.now())) return inProgress;
      await ctx.runMutation(internal.notionData.forgetTarget, { id: existing._id });
      existing = null;
    }
    if (!existing && !parentId) return { ok: false, message: "Choose a Notion page first." };

    const notebook = await ctx.runQuery(internal.exports.notebookFor, { documentId });
    const batches = notionBlockBatches(notebookBlocks(notebook));
    const authorization = `Bearer ${connection.accessToken}`;
    const id = existing?._id ?? await ctx.runMutation(internal.notionData.claimTarget, {
      userId, documentId, parentId: parentId ?? "",
    });
    if (!id) return inProgress;

    let remoteId = existing?.remoteId;
    let url = existing?.url;
    try {
      const oldBlocks = remoteId ? await listBlocks(remoteId, authorization) : [];
      if (!remoteId || !url) {
        const page = await request<{ id: string; url: string }>("/pages", authorization, "POST", {
          parent: { type: "page_id", page_id: parentId },
          properties: { title: { type: "title", title: [{ type: "text", text: { content: Array.from(notebook.title).slice(0, 1000).join("") } }] } },
        });
        remoteId = page.id;
        url = page.url;
        await ctx.runMutation(internal.notionData.saveTarget, { id, remoteId, url, lastSentAt: 0 });
      }
      for (const children of batches) {
        await request(`/blocks/${encodeURIComponent(remoteId)}/children`, authorization, "PATCH", { children });
      }
      for (const blockId of oldBlocks) {
        // A block the reader already removed in Notion is fine: the new content is on the page.
        await request(`/blocks/${encodeURIComponent(blockId)}`, authorization, "DELETE").catch((error) => {
          if (!(error instanceof NotionError && error.status === 404)) throw error;
        });
      }
      await ctx.runMutation(internal.notionData.saveTarget, { id, remoteId, url, lastSentAt: Date.now() });
      return { ok: true, url };
    } catch (error) {
      if (error instanceof NotionError && error.status === 401) {
        if (!remoteId) await ctx.runMutation(internal.notionData.forgetTarget, { id });
        await ctx.runMutation(internal.notionData.forgetConnection, { userId, accessToken: connection.accessToken });
        return reconnect;
      }
      if (error instanceof NotionError && [403, 404].includes(error.status)) {
        // Only this page is out of reach, so the reader's other books stay connected.
        await ctx.runMutation(internal.notionData.forgetTarget, { id });
        return { ok: false, message: PAGE_GONE };
      }
      if (!remoteId) await ctx.runMutation(internal.notionData.forgetTarget, { id });
      return unavailable;
    }
  },
});
