import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, httpAction, type ActionCtx } from "./_generated/server";
import { requireUser } from "./helpers";
import { googleBatchUpdate, googleDocumentBody } from "./googleRules";

const driveRoot = "https://www.googleapis.com/drive/v3";
const docsRoot = "https://docs.googleapis.com/v1";
const tokenUrl = "https://oauth2.googleapis.com/token";
const driveFileScope = "https://www.googleapis.com/auth/drive.file";
const reconnect = { ok: false as const, message: "Reconnect Google" };
const unavailable = { ok: false as const, message: "Google Docs isn’t available. Try again." };

class GoogleError extends Error {
  constructor(readonly status: number) {
    super(`Google returned HTTP ${status}`);
  }
}

type OAuthConfiguration = { clientId: string; clientSecret: string; redirectUri: string };

function oauthConfiguration(): OAuthConfiguration | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const convexSite = process.env.CONVEX_SITE_URL;
  if (!clientId || !clientSecret || !convexSite) return null;
  return { clientId, clientSecret, redirectUri: new URL("/oauth/google/callback", convexSite).href };
}

async function tokenRequest(config: OAuthConfiguration, values: Record<string, string>) {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values }),
  });
  if (!response.ok) throw new GoogleError(response.status);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number }>;
}

async function googleRequest<T>(url: string, accessToken: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new GoogleError(response.status);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export const connect = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }): Promise<{ url: string } | { message: string }> => {
    const userId = await requireUser(ctx);
    const config = oauthConfiguration();
    if (!config || !process.env.SITE_URL) return { message: "Google Docs isn’t set up yet." };
    const state = crypto.randomUUID();
    await ctx.runMutation(internal.googleData.begin, { state, userId, documentId });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: driveFileScope,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return { url: url.href };
  },
});

export const callback = httpAction(async (ctx, req) => {
  const params = new URL(req.url).searchParams;
  const state = params.get("state");
  const pending = state && await ctx.runMutation(internal.googleData.consumeState, { state });
  const config = oauthConfiguration();
  const site = process.env.SITE_URL;
  if (!pending || !config || !site) return new Response("Please reconnect Google from Ingrain.", { status: 400 });

  const destination = new URL(pending.returnTo, site);
  const code = params.get("code");
  if (code && !params.has("error")) {
    try {
      const tokens = await tokenRequest(config, {
        grant_type: "authorization_code", code, redirect_uri: config.redirectUri,
      });
      await ctx.runMutation(internal.googleData.storeConnection, {
        userId: pending.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : undefined,
        accountName: "Google Drive",
      });
    } catch (error) {
      const diagnostic = error instanceof GoogleError ? `HTTP ${error.status}` : error instanceof Error ? error.name : "Unknown error";
      console.error("Google OAuth callback failed:", diagnostic);
      destination.searchParams.set("google", "error");
    }
  } else {
    destination.searchParams.set("google", "error");
  }
  return Response.redirect(destination, 303);
});

type GoogleConnection = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

async function accessTokenFor(
  ctx: ActionCtx,
  userId: Id<"users">,
  connection: GoogleConnection,
  config: OAuthConfiguration,
) {
  if (!connection.expiresAt || connection.expiresAt > Date.now() + 60_000) return connection.accessToken;
  if (!connection.refreshToken) {
    await ctx.runMutation(internal.googleData.forgetConnection, { userId, accessToken: connection.accessToken });
    return null;
  }
  try {
    const tokens = await tokenRequest(config, {
      grant_type: "refresh_token", refresh_token: connection.refreshToken,
    });
    await ctx.runMutation(internal.googleData.storeConnection, {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: typeof tokens.expires_in === "number" ? Date.now() + tokens.expires_in * 1000 : undefined,
      accountName: "Google Drive",
    });
    return tokens.access_token;
  } catch (error) {
    if (error instanceof GoogleError && [400, 401].includes(error.status)) {
      await ctx.runMutation(internal.googleData.forgetConnection, { userId, accessToken: connection.accessToken });
      return null;
    }
    throw error;
  }
}

async function folderFor(accessToken: string) {
  const listUrl = new URL(`${driveRoot}/files`);
  listUrl.search = new URLSearchParams({
    q: "name = 'Ingrain notes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    spaces: "drive",
    fields: "files(id,name)",
    pageSize: "10",
  }).toString();
  const existing = await googleRequest<{ files: { id: string }[] }>(listUrl.href, accessToken);
  if (existing.files?.[0]) return existing.files[0].id;
  const created = await googleRequest<{ id: string }>(`${driveRoot}/files?fields=id`, accessToken, "POST", {
    name: "Ingrain notes", mimeType: "application/vnd.google-apps.folder",
  });
  return created.id;
}

async function createDocument(title: string, folderId: string, accessToken: string) {
  return googleRequest<{ id: string; webViewLink?: string }>(
    `${driveRoot}/files?fields=id,webViewLink`, accessToken, "POST",
    { name: Array.from(title.trim()).slice(0, 255).join("") || "Ingrain notes", mimeType: "application/vnd.google-apps.document", parents: [folderId] },
  );
}

async function documentEndIndex(documentId: string, accessToken: string) {
  const url = `${docsRoot}/documents/${encodeURIComponent(documentId)}?fields=body.content.endIndex`;
  const document = await googleRequest<{ body?: { content?: { endIndex?: number }[] } }>(url, accessToken);
  return Math.max(1, ...(document.body?.content ?? []).map(({ endIndex }) => endIndex ?? 1));
}

export const send = action({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }): Promise<typeof reconnect | typeof unavailable | { ok: true; url: string }> => {
    const userId = await requireUser(ctx);
    const existing = await ctx.runQuery(internal.googleData.bookTarget, { userId, documentId });
    const connection = await ctx.runQuery(internal.googleData.connectionFor, { userId });
    if (!connection) return reconnect;
    if (existing && !existing.remoteId) return { ok: false, message: "An export is already in progress." };
    const config = oauthConfiguration();
    if (!config) return unavailable;

    let accessToken: string | null;
    try {
      accessToken = await accessTokenFor(ctx, userId, connection, config);
    } catch {
      return unavailable;
    }
    if (!accessToken) return reconnect;

    const notebook = await ctx.runQuery(internal.exports.notebookFor, { documentId });
    let id = existing?._id;
    let remoteId = existing?.remoteId;
    let url = existing?.url;
    try {
      if (!id) {
        const parentId = await folderFor(accessToken);
        const claimed = await ctx.runMutation(internal.googleData.claimTarget, { userId, documentId, parentId });
        if (!claimed) return { ok: false, message: "An export is already in progress." };
        id = claimed;
      }
      const isNew = !remoteId;
      if (!remoteId || !url) {
        const row = await ctx.runQuery(internal.googleData.bookTarget, { userId, documentId });
        const document = await createDocument(notebook.title, row?.parentId ?? "", accessToken);
        remoteId = document.id;
        url = document.webViewLink ?? `https://docs.google.com/document/d/${encodeURIComponent(remoteId)}/edit`;
        await ctx.runMutation(internal.googleData.saveTarget, { id, remoteId, url, lastSentAt: 0 });
      }
      const endIndex = isNew ? 1 : await documentEndIndex(remoteId, accessToken);
      const update = googleBatchUpdate(googleDocumentBody(notebook), endIndex);
      await googleRequest(`${docsRoot}/documents/${encodeURIComponent(remoteId)}:batchUpdate`, accessToken, "POST", update);
      await ctx.runMutation(internal.googleData.saveTarget, { id, remoteId, url, lastSentAt: Date.now() });
      return { ok: true, url };
    } catch (error) {
      if (!remoteId && id) await ctx.runMutation(internal.googleData.forgetTarget, { id });
      if (error instanceof GoogleError && error.status === 401) {
        await ctx.runMutation(internal.googleData.forgetConnection, { userId, accessToken });
        return reconnect;
      }
      if (error instanceof GoogleError && error.status === 404 && id) {
        await ctx.runMutation(internal.googleData.forgetTarget, { id });
      }
      return unavailable;
    }
  },
});
