"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { readableTitle } from "./text";
import { IconButton, Icons } from "./Tooltip";

export const AUTO_OPEN_MS = 10000; // how long the card stays open by itself after a chapter is finished

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoToken: number | null; // changes each time the card opens by itself (a chapter was just finished)
  finished: boolean; // the card is about a chapter the reader just finished
  chapterTitle: string | null;
  canReflect: boolean;
  waiting: boolean; // a finished chapter has no reflection yet
  onReflect: () => void;
  testHref: string;
};

const round = "relative flex h-9 w-9 items-center justify-center rounded-full text-lg hover:bg-accent-soft";

// Bottom-right corner: Reflect and Test yourself. Collapsed it is a small pill; expanded it is a card the reader can
// open and close. After a chapter is finished it opens by itself for 10 seconds (paused while the pointer is on it).
export function ChapterDock({ open, onOpenChange, autoToken, finished, chapterTitle, canReflect, waiting, onReflect, testHref }: Props) {
  const router = useRouter();
  // The countdown runs for the latest automatic opening until it ends or the reader takes over.
  const [stoppedFor, setStoppedFor] = useState<number | null>(null);
  const counting = autoToken !== null && stoppedFor !== autoToken;
  const remaining = useRef(AUTO_OPEN_MS);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    setStoppedFor(autoToken);
  }, [autoToken]);

  const run = useCallback(() => {
    window.clearTimeout(timer.current);
    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => {
      setStoppedFor(autoToken);
      onOpenChange(false);
    }, remaining.current);
  }, [onOpenChange, autoToken]);

  // A chapter was just finished: start the countdown.
  useEffect(() => {
    if (autoToken === null) return;
    remaining.current = AUTO_OPEN_MS;
    if (!held.current) run();
    return () => window.clearTimeout(timer.current);
  }, [autoToken, run]);

  const hold = (on: boolean) => {
    held.current = on;
    if (!counting) return;
    if (on) {
      window.clearTimeout(timer.current);
      remaining.current = Math.max(1000, remaining.current - (performance.now() - startedAt.current));
    } else run();
  };

  const setOpen = (next: boolean) => {
    stop(); // the reader took over, so no more automatic closing
    onOpenChange(next);
  };

  const test = () => router.push(testHref);
  const reflect = () => {
    stop();
    onReflect();
  };

  if (!open) {
    return (
      <div role="group" aria-label="Chapter actions" className="absolute bottom-4 right-4 z-10 flex items-center gap-0.5 rounded-full border border-line bg-card p-1 shadow-md">
        {canReflect && (
          <IconButton label={waiting ? "Reflect on the chapter you finished" : "Reflect"} onClick={reflect} className={round}>
            <span aria-hidden="true">✏️</span>
            {waiting && <span aria-hidden="true" className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card" />}
          </IconButton>
        )}
        <IconButton label="Test yourself" onClick={test} className={round}>
          <span aria-hidden="true">❓</span>
        </IconButton>
        <IconButton label="Show chapter card" side="left" onClick={() => setOpen(true)} className={`${round} text-muted`}>
          {Icons.expand}
        </IconButton>
      </div>
    );
  }

  return (
    <section
      aria-label="Chapter actions"
      onMouseEnter={() => hold(true)}
      onMouseLeave={() => hold(false)}
      onFocusCapture={() => hold(true)}
      onBlurCapture={() => hold(false)}
      className="group absolute bottom-4 right-4 z-10 w-80 rounded-2xl border border-line bg-card shadow-xl"
    >
      <div className="flex items-start gap-3 p-4 pb-3" role="status">
        <span aria-hidden="true" className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${finished ? "bg-good/15 text-good" : "bg-accent-soft"}`}>
          {finished ? "✓" : "📖"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{finished ? "Chapter finished" : "You're reading"}</p>
          <p className="mt-0.5 font-semibold leading-snug">{chapterTitle ? readableTitle(chapterTitle) : "This book"}</p>
          {finished && <p className="mt-1 text-sm text-muted">What did you take away?</p>}
        </div>
        <IconButton label="Collapse" side="top" onClick={() => setOpen(false)} className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-ink">
          {Icons.collapse}
        </IconButton>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        {canReflect && (
          <button onClick={reflect} className="btn-primary flex-1 whitespace-nowrap px-3">
            <span aria-hidden="true">✏️</span> Reflect
          </button>
        )}
        <button onClick={test} className="btn-ghost flex-1 whitespace-nowrap px-3">
          <span aria-hidden="true">❓</span> Test yourself
        </button>
      </div>
      {counting && (
        <div className="h-1 overflow-hidden rounded-b-2xl bg-line" aria-hidden="true">
          <div key={autoToken ?? 0} className="dock-countdown h-full bg-accent group-hover:[animation-play-state:paused]" />
        </div>
      )}
    </section>
  );
}
