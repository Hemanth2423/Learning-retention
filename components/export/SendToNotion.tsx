"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const RECONNECT = "Reconnect Notion";
const button = "chunky chunky-light chunky-sm mt-2 w-full";

export function SendToNotion({ documentId }: { documentId: Id<"documents"> }) {
  const connection = useQuery(api.notionData.connection);
  const target = useQuery(api.notionData.savedTarget, { documentId });
  const connect = useAction(api.notion.connect);
  const listPages = useAction(api.notion.listPages);
  const send = useAction(api.notion.send);
  const [pages, setPages] = useState<{ id: string; title: string }[] | null>(null);
  const [parentId, setParentId] = useState("");
  // Notion sends the reader back here with ?notion=error when the connection failed.
  // Safe to read on first render: this component renders nothing until Convex data loads in the browser.
  const [message, setMessage] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("notion") === "error"
      ? "Couldn’t connect to Notion. Try again." : "");
  const [busy, setBusy] = useState<"" | "connect" | "pages" | "send">("");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("notion")) return;
    url.searchParams.delete("notion");
    window.history.replaceState(null, "", url);
  }, []);

  async function run(kind: "connect" | "pages" | "send", operation: () => Promise<void>) {
    setBusy(kind);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      console.error("Send to Notion failed:", error);
      setMessage("Something went wrong. Try again.");
    } finally {
      setBusy("");
    }
  }

  if (!connection || target === undefined) return null;
  const needsConnection = !connection.connected || message === RECONNECT;

  const connectButton = (
    <button type="button" className={button} disabled={busy !== ""} onClick={() => void run("connect", async () => {
      const result = await connect({ documentId });
      if ("url" in result) window.location.assign(result.url);
      else setMessage(result.message);
    })}>
      {busy === "connect" ? "Opening Notion…" : connection.connected || message === RECONNECT ? RECONNECT : "Connect Notion"}
    </button>
  );

  return (
    <div className="mt-4 border-t border-line pt-4 text-sm">
      <p className="font-medium">Send to Notion</p>
      {connection.connected && connection.workspaceName && !needsConnection && (
        <p className="text-xs text-muted">Connected to {connection.workspaceName}</p>
      )}

      {needsConnection ? connectButton : (
        <>
          {!target && pages === null && (
            <button type="button" className={button} disabled={busy !== ""} onClick={() => void run("pages", async () => {
              const result = await listPages({});
              if (result.ok) setPages(result.pages);
              else setMessage(result.message);
            })}>{busy === "pages" ? "Loading pages…" : "Choose a page"}</button>
          )}

          {!target && pages !== null && pages.length > 0 && (
            <label className="mt-2 block text-xs text-muted">
              Put the notes inside
              <select className="input mt-1" value={parentId} onChange={(event) => setParentId(event.target.value)}>
                <option value="">Choose a page</option>
                {pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}
              </select>
            </label>
          )}

          {!target && pages?.length === 0 && (
            <>
              <p className="mt-2 text-xs text-muted">
                Ingrain can’t see any pages yet. Reconnect and tick at least one page to share.
              </p>
              {connectButton}
            </>
          )}

          {(target || (pages && pages.length > 0)) && (
            <button type="button" className={button} disabled={busy !== "" || (!target && !parentId)}
              onClick={() => void run("send", async () => {
                const result = await send({ documentId, parentId: parentId || undefined });
                setMessage(result.ok ? "Sent to Notion." : result.message);
                if (!result.ok && result.message === RECONNECT) {
                  setPages(null);
                  setParentId("");
                }
              })}>{busy === "send" ? "Sending…" : target ? "Send again" : "Send now"}</button>
          )}
        </>
      )}

      {target && (
        <p className="mt-2 text-xs text-muted">
          {target.lastSentAt > 0 && <>Last sent {new Date(target.lastSentAt).toLocaleString()} · </>}
          <a className="underline hover:text-accent" href={target.url} target="_blank" rel="noreferrer">Open in Notion ↗</a>
        </p>
      )}
      {message && message !== RECONNECT && <p className="mt-2 text-xs text-muted" role="status">{message}</p>}
    </div>
  );
}
