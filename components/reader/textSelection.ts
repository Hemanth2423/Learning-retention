// Precise text selection over pdf.js text layers, following what pdf.js's own viewer does (TextLayerBuilder).
// A text layer is absolutely placed spans with gaps between them. Dragging over a gap makes the browser snap the
// selection to whatever comes next in the DOM, often lines further down. An invisible "end of content" element,
// moved right after the selection's moving edge, catches the pointer in those gaps so the selection stays put.

const layers = new Map<HTMLElement, HTMLElement>(); // text layer → its end-of-content element
let listening = false;
let pointerDown = false;
let previous: Range | null = null;

function reset(layer: HTMLElement, end: HTMLElement) {
  layer.append(end); // back to the end of the layer
  end.style.width = "";
  end.style.height = "";
  layer.classList.remove("selecting");
}
const resetAll = () => layers.forEach((end, layer) => reset(layer, end));

function onSelectionChange() {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return resetAll();
  const range = selection.getRangeAt(0);
  layers.forEach((end, layer) => {
    if (range.intersectsNode(layer)) layer.classList.add("selecting");
    else reset(layer, end);
  });
  if (!pointerDown || selection.isCollapsed) {
    previous = range.cloneRange();
    return;
  }
  // Which edge is moving? If the end stayed where it was, the reader is dragging the start.
  const movingStart =
    !!previous && (range.compareBoundaryPoints(Range.END_TO_END, previous) === 0 || range.compareBoundaryPoints(Range.START_TO_END, previous) === 0);
  let anchor: Node | null = movingStart ? range.startContainer : range.endContainer;
  if (anchor?.nodeType === Node.TEXT_NODE) anchor = anchor.parentNode;
  // An end at offset 0 really sits after the previous span.
  if (!movingStart && range.endOffset === 0) {
    do {
      while (anchor && !anchor.previousSibling) anchor = anchor.parentNode;
      anchor = anchor?.previousSibling ?? null;
    } while (anchor && !anchor.childNodes.length);
  }
  const parent = anchor?.parentElement;
  const layer = parent?.closest<HTMLElement>(".textLayer");
  const end = layer ? layers.get(layer) : undefined;
  if (anchor && parent && layer && end && anchor !== end) {
    end.style.width = `${layer.clientWidth}px`;
    end.style.height = `${layer.clientHeight}px`;
    parent.insertBefore(end, movingStart ? anchor : anchor.nextSibling);
  }
  previous = range.cloneRange();
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener("pointerdown", () => (pointerDown = true));
  document.addEventListener("pointerup", () => {
    pointerDown = false;
    resetAll();
  });
  window.addEventListener("blur", () => {
    pointerDown = false;
    resetAll();
  });
  document.addEventListener("selectionchange", onSelectionChange);
}

// Call once a page's text layer is drawn; the returned function removes it again.
export function registerTextLayer(layer: HTMLElement): () => void {
  listen();
  const end = document.createElement("div");
  end.className = "endOfContent";
  layer.append(end);
  layers.set(layer, end);
  const select = () => layer.classList.add("selecting");
  layer.addEventListener("mousedown", select);
  return () => {
    layer.removeEventListener("mousedown", select);
    layers.delete(layer);
    end.remove();
    layer.classList.remove("selecting");
  };
}
