"use client";

import { IconButton, Icons } from "./Tooltip";

type Props = {
  selection: { x: number; y: number }; // where the selection is, in window coordinates
  onHighlight: () => void;
  onComment: () => void;
  onAsk?: () => void; // only when chat is available
};

const button = "flex h-9 w-9 items-center justify-center rounded-md hover:bg-paper/15 focus-visible:bg-paper/15 outline-none";

// The small icon menu above selected text. Each icon names itself when the pointer is over it.
export function SelectionMenu({ selection, onHighlight, onComment, onAsk }: Props) {
  const left = Math.min(Math.max(selection.x, 90), window.innerWidth - 90);
  const top = Math.max(selection.y - 8, 56);
  return (
    <div
      role="toolbar"
      aria-label="Selected text"
      style={{ left, top, transform: "translate(-50%, -100%)" }}
      // Keep the text selected while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-30 flex gap-0.5 rounded-lg bg-ink p-1 text-paper shadow-lg"
    >
      <IconButton label="Highlight" onClick={onHighlight} className={button}>
        {Icons.highlight}
      </IconButton>
      <IconButton label="Add comment" onClick={onComment} className={button}>
        {Icons.comment}
      </IconButton>
      {onAsk && (
        <IconButton label="Ask AI" onClick={onAsk} className={button}>
          {Icons.ask}
        </IconButton>
      )}
    </div>
  );
}
