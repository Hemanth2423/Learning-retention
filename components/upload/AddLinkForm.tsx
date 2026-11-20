"use client";

import { useAction } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Paste an article or YouTube link. The server reads it (Firecrawl / YouTube) and opens it when it's ready.
export function AddLinkForm() {
  const add = useAction(api.links.add);
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; documentId?: Id<"documents"> } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await add({ url }).catch(() => ({ ok: false as const, message: "We couldn't add that link just now. Try again." }));
    setBusy(false);
    if (res.ok) {
      setUrl("");
      router.push(`/read/${res.documentId}/book`);
    } else setError({ message: res.message, documentId: "documentId" in res ? res.documentId : undefined });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-card p-3">
      <label htmlFor="add-link" className="text-[13px] font-semibold">
        🔗 Or add a link
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="add-link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Article or YouTube link"
          inputMode="url"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line bg-cream px-2.5 py-1.5 text-sm outline-none focus:border-ink"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !url.trim()} className="chunky px-3 py-1.5 text-sm disabled:opacity-50">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {busy && <p className="mt-1.5 text-[13px] text-muted">Reading the page… this can take a few seconds.</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-accent-dark">
          {error.message}{" "}
          {error.documentId && (
            <Link href={`/read/${error.documentId}/book`} className="font-semibold underline">
              Open it
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
