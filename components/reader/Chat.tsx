"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CitedText } from "./CitedText";
import { whenOf } from "./time";

type Message = { _id: string; role: "user" | "assistant"; text: string; citations: { n: number; page: number }[] };
const NO_MESSAGES: Message[] = [];

// Chat state for one book: the saved history, today's questions left, and sending.
export function useChat(documentId: Id<"documents">) {
  const messages = (useQuery(api.chat.history, { documentId }) as Message[] | undefined) ?? NO_MESSAGES;
  const quota = useQuery(api.chat.quota);
  const askAction = useAction(api.chat.ask);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(text: string, mode: "chat" | "summarize", currentPage: number) {
    if (pending) return false;
    setPending(true);
    setError(null);
    try {
      const res = await askAction({ documentId, question: text, currentPage, mode });
      if (!res.ok) {
        setError(res.resetAt ? `You've used today's questions. The next one frees up ${whenOf(res.resetAt)}.` : res.message);
        return false;
      }
      return true;
    } catch {
      setError("We couldn't get an answer just now. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { messages, quota, pending, error, send };
}
export type ChatState = ReturnType<typeof useChat>;

export function ChatPanel({
  chat,
  page,
  draft,
  onDraft,
  onJump,
}: {
  chat: ChatState;
  page: number;
  draft: string;
  onDraft: (text: string) => void;
  onJump: (page: number) => void;
}) {
  const { messages, quota, pending, error, send } = chat;
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const left = quota?.left;
  const noneLeft = left === 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  // "Ask AI" on selected text drops it into the box; put the cursor there.
  useEffect(() => {
    if (draft) inputRef.current?.focus();
  }, [draft]);

  async function submit() {
    const text = draft.trim();
    if (!text || pending || noneLeft) return;
    onDraft("");
    if (!(await send(text, "chat", page))) onDraft(text); // a failed question stays in the box
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && !pending && <p className="text-sm text-muted">Ask anything about this book. Answers come from its pages, with page links.</p>}
        {messages.map((m) =>
          m.role === "user" ? (
            <p key={m._id} className="ml-auto w-fit max-w-[85%] whitespace-pre-line rounded-2xl bg-accent-soft px-3 py-2 text-sm">
              {m.text}
            </p>
          ) : (
            <p key={m._id} className="whitespace-pre-line text-sm leading-relaxed">
              <CitedText text={m.text} pages={m.citations} onJump={onJump} />
            </p>
          )
        )}
        {pending && <p className="text-sm text-muted">Thinking…</p>}
        {error && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            onClick={() => void send("", "summarize", page)}
            disabled={pending || noneLeft}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-accent-soft disabled:opacity-50"
          >
            Summarize this chapter
          </button>
        </div>
        <textarea
          ref={inputRef}
          value={draft}
          rows={2}
          maxLength={1000}
          disabled={pending || noneLeft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          aria-label="Ask about this book"
          placeholder={noneLeft ? "No questions left today" : "Ask about this book…"}
          className="input resize-none"
        />
        <p className="mt-1.5 text-xs text-muted">
          {left === undefined ? "" : noneLeft ? `Out of questions for today.${quota?.resetAt ? ` The next one frees up ${whenOf(quota.resetAt)}.` : ""}` : `${left} left today`}
        </p>
      </div>
    </div>
  );
}
