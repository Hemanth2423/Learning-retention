"use client";

import type { SelectionInfo } from "./PdfViewer";

type Props = {
  selection: SelectionInfo;
  onHighlight: () => void;
  onComment: () => void;
  onAsk?: () => void; // only shown once chat exists
};

// The small menu that appears above selected text.
export function SelectionMenu({ selection, onHighlight, onComment, onAsk }: Props) {
  const left = Math.min(Math.max(selection.x, 130), window.innerWidth - 130);
  const top = Math.max(selection.y - 8, 56);
  const button = "px-3 py-1.5 text-sm font-medium hover:bg-paper/15 focus-visible:bg-paper/15 outline-none";
  return (
    <div
      role="toolbar"
      aria-label="Selected text"
      style={{ left, top, transform: "translate(-50%, -100%)" }}
      // Keep the text selected while a button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-30 flex divide-x divide-paper/20 overflow-hidden rounded-lg bg-ink text-paper shadow-lg"
    >
      <button onClick={onHighlight} className={button}>
        Highlight
      </button>
      <button onClick={onComment} className={button}>
        + Comment
      </button>
      {onAsk && (
        <button onClick={onAsk} className={button}>
          Ask AI
        </button>
      )}
    </div>
  );
}
