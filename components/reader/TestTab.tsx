"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HOLD_MS, shouldExpand } from "./reveal";

const USER_INPUT_MS = 400;

// A small tab on the bottom edge. It opens when scrolling starts and closes 3 seconds later, so it is
// easy to find without distracting. Hovering or focusing it keeps it open so it can be clicked.
export function useTestTabReveal() {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const lastScrollAt = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false); // pointer over it, or keyboard focus on it
  const closeWhenReleased = useRef(false);
  // Only the reader's own scrolling opens the tab. Jumps and the page restoring itself also fire scroll events,
  // so a scroll counts only right after a wheel, touch, key press, or while a mouse button is held (dragging the scrollbar).
  const lastInputAt = useRef(-Infinity);
  const pointerDown = useRef(false);

  const set = useCallback((open: boolean) => {
    expandedRef.current = open;
    setExpanded(open);
  }, []);

  const collapse = useCallback(() => {
    if (held.current) closeWhenReleased.current = true;
    else set(false);
  }, [set]);

  // Call on every scroll of the book.
  const onScroll = useCallback(() => {
    const now = performance.now();
    if (!pointerDown.current && now - lastInputAt.current > USER_INPUT_MS) return;
    const selecting = window.getSelection()?.isCollapsed === false;
    const open = shouldExpand({ lastScrollAt: lastScrollAt.current, now, expanded: expandedRef.current, selecting });
    lastScrollAt.current = now;
    if (!open) return;
    set(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(collapse, HOLD_MS);
  }, [set, collapse]);

  const hold = useCallback(
    (on: boolean) => {
      held.current = on;
      if (on) set(true);
      else if (closeWhenReleased.current) {
        closeWhenReleased.current = false;
        set(false);
      }
    },
    [set]
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const noteInput = useCallback(() => {
    lastInputAt.current = performance.now();
  }, []);
  // Spread these on the element that holds the book.
  const handlers = {
    onScrollCapture: onScroll,
    onWheelCapture: noteInput,
    onTouchMoveCapture: noteInput,
    onKeyDownCapture: noteInput,
    onPointerDownCapture: () => {
      pointerDown.current = true;
      noteInput();
    },
    onPointerUpCapture: () => {
      pointerDown.current = false;
    },
  };
  return { expanded, handlers, hold };
}

export function TestTab({ href, expanded, onHold }: { href: string; expanded: boolean; onHold: (on: boolean) => void }) {
  return (
    <Link
      href={href}
      aria-label="Test your understanding"
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
      onFocus={() => onHold(true)}
      onBlur={() => onHold(false)}
      className={`absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 items-center justify-center overflow-hidden rounded-t-xl border border-b-0 border-line bg-card text-sm font-medium shadow-md transition-all duration-300 motion-reduce:transition-none ${
        expanded ? "h-9 px-4 opacity-100" : "h-2.5 w-16 opacity-70 hover:opacity-100"
      }`}
    >
      <span className={expanded ? "whitespace-nowrap" : "sr-only"}>Test your understanding</span>
    </Link>
  );
}
