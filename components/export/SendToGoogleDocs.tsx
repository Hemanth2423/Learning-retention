"use client";

import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const RECONNECT = "Reconnect Google";
const button = "chunky chunky-light chunky-sm mt-2 w-full";

export function SendToGoogleDocs({ documentId }: { documentId: Id<"documents"> }) {
  const connection = useQuery(api.googleData.connection);
  const target = useQuery(api.googleData.savedTarget, { documentId });
  const connect = useAction(api.google.connect);
  const send = useAction(api.google.send);
  const [message, setMessage] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("google") === "error"
      ? "Couldn’t connect to Google. Try again." : "");
  const [busy, setBusy] = useState<"" | "connect" | "send">("");

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("google")) return;
    url.searchParams.delete("google");
    window.history.replaceState(null, "", url);
  }, []);

  async function run(kind: "connect" | "send", operation: () => Promise<void>) {
    setBusy(kind);
    setMessage("");
    try {
      await operation();
    } catch (error) {
      console.error("Send to Google Docs failed:", error);
      setMessage("Something went wrong. Try again.");
    } finally {
      setBusy("");
    }
  }

  if (!connection || target === undefined) return null;
  const needsConnection = !connection.connected || message === RECONNECT;

  return (
    <div className="mt-4 border-t border-line pt-4 text-sm">
      <p className="font-medium">Send to Google Docs</p>
      {connection.connected && connection.accountName && !needsConnection && (
        <p className="text-xs text-muted">Connected to {connection.accountName}</p>
      )}

      {needsConnection ? (
        <button type="button" className={button} disabled={busy !== ""} onClick={() => void run("connect", async () => {
          const result = await connect({ documentId });
          if ("url" in result) window.location.assign(result.url);
          else setMessage(result.message);
        })}>
          {busy === "connect" ? "Opening Google…" : connection.connected || message === RECONNECT ? RECONNECT : "Connect Google"}
        </button>
      ) : (
        <button type="button" className={button} disabled={busy !== ""} onClick={() => void run("send", async () => {
          const result = await send({ documentId });
          setMessage(result.ok ? "Sent to Google Docs." : result.message);
        })}>
          {busy === "send" ? "Sending…" : target ? "Send again" : "Send now"}
        </button>
      )}

      {target && (
        <p className="mt-2 text-xs text-muted">
          {target.lastSentAt > 0 && <>Last sent {new Date(target.lastSentAt).toLocaleString()} · </>}
          <a className="underline hover:text-accent" href={target.url} target="_blank" rel="noreferrer">Open in Google Docs ↗</a>
        </p>
      )}
      {message && message !== RECONNECT && <p className="mt-2 text-xs text-muted" role="status">{message}</p>}
    </div>
  );
}
