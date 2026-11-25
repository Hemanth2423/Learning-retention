// Highlights in text sources (articles, EPUB, Word). Each block of text is an element with data-block="n"; a highlight
// is stored as character offsets inside blocks (convex/highlightRules.ts → TextRange). Highlights are painted with the
// CSS Custom Highlight API, which draws over ranges without changing the page's DOM (so React's rendering is untouched).
import type { TextRange } from "@/convex/highlightRules";

const blockOf = (node: Node | null): HTMLElement | null => (node instanceof Element ? node : node?.parentElement ?? null)?.closest<HTMLElement>("[data-block]") ?? null;

// Characters before (node, offset) inside the block, counting text only.
function offsetIn(block: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(block);
  range.setEnd(node, offset);
  return range.toString().length;
}

// The current selection as a TextRange, if it lies inside the text. Null for empty or outside selections.
export function selectionRange(root: HTMLElement): { range: TextRange; text: string; rect: DOMRect } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return null;
  const startBlock = blockOf(r.startContainer);
  const endBlock = blockOf(r.endContainer);
  if (!startBlock || !endBlock) return null;
  const text = r.toString();
  if (!text.trim()) return null;
  return {
    range: {
      startBlock: Number(startBlock.dataset.block),
      startOffset: offsetIn(startBlock, r.startContainer, r.startOffset),
      endBlock: Number(endBlock.dataset.block),
      endOffset: offsetIn(endBlock, r.endContainer, r.endOffset),
    },
    text,
    rect: r.getBoundingClientRect(),
  };
}

// The text node and local offset at a character position inside a block.
function pointAt(block: HTMLElement, offset: number): [Node, number] | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let left = offset;
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (left <= n.data.length) return [n, left];
    left -= n.data.length;
    last = n;
  }
  return last ? [last, last.data.length] : null;
}

export function domRange(root: HTMLElement, r: TextRange): Range | null {
  const a = root.querySelector<HTMLElement>(`[data-block="${r.startBlock}"]`);
  const b = root.querySelector<HTMLElement>(`[data-block="${r.endBlock}"]`);
  if (!a || !b) return null;
  const start = pointAt(a, r.startOffset);
  const end = pointAt(b, r.endOffset);
  if (!start || !end) return null;
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range;
}

type HighlightRegistry = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const registry = (): HighlightRegistry | null => (typeof CSS !== "undefined" && "highlights" in CSS ? (CSS as unknown as { highlights: HighlightRegistry }).highlights : null);
const HighlightCtor = (): (new (...ranges: Range[]) => unknown) | null =>
  typeof window !== "undefined" && "Highlight" in window ? (window as unknown as { Highlight: new (...ranges: Range[]) => unknown }).Highlight : null;

// Paints every highlight (styled by ::highlight(ingrain-hl) in globals.css). Unsupported browsers just don't paint.
export function paintHighlights(root: HTMLElement, ranges: TextRange[]) {
  const reg = registry();
  const H = HighlightCtor();
  if (!reg || !H) return;
  const doms = ranges.map((r) => domRange(root, r)).filter((r): r is Range => !!r);
  reg.set("ingrain-hl", new H(...doms));
}

// Scrolls to a highlight and flashes it once.
export function flashHighlight(root: HTMLElement, r: TextRange) {
  const range = domRange(root, r);
  if (!range) return;
  const el = range.startContainer.parentElement;
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  const reg = registry();
  const H = HighlightCtor();
  if (!reg || !H) return;
  reg.set("ingrain-flash", new H(range));
  window.setTimeout(() => reg.delete("ingrain-flash"), 1600);
}
