"use client";

import { ReactNode } from "react";

// An icon button with a label that appears as soon as the pointer is over it (or it has keyboard focus).
export function IconButton({
  label,
  onClick,
  disabled,
  side = "top",
  className = "",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  side?: "top" | "bottom" | "left";
  className?: string;
  children: ReactNode;
}) {
  const place =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : side === "bottom"
        ? "top-full left-1/2 mt-2 -translate-x-1/2"
        : "right-full top-1/2 mr-2 -translate-y-1/2";
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={className}>
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-paper opacity-0 shadow transition-opacity delay-100 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 ${place}`}
      >
        {label}
      </span>
    </span>
  );
}

const svg = (paths: ReactNode, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

export const Icons = {
  highlight: svg(
    <>
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </>
  ),
  comment: svg(
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 7v6M9 10h6" />
    </>
  ),
  ask: svg(
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
    </>
  ),
  prev: svg(<path d="m15 18-6-6 6-6" />, 16),
  next: svg(<path d="m9 18 6-6-6-6" />, 16),
  minus: svg(<path d="M5 12h14" />, 16),
  plus: svg(<path d="M12 5v14M5 12h14" />, 16),
  expand: svg(<path d="m18 15-6-6-6 6" />, 16),
  collapse: svg(<path d="m6 9 6 6 6-6" />, 16),
};
