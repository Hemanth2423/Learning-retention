// Making cover images in the browser (no AI, no server work): a PDF's first page, drawn small with pdf.js.
// The server checks the image before saving it (documents.setCover).
import { looksLikeCover } from "@/convex/documentRules";

const COVER_WIDTH = 360; // px; tiles show at most ~200 px wide, so this stays sharp on retina screens

// Returns null when page 1 isn't a cover (a mostly white text or title page): the colour cover looks better.
export async function renderPdfCover(source: { data: ArrayBuffer } | { url: string }): Promise<Blob | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // Only the first page is needed: don't stream or prefetch the rest of a large file.
  const task = pdfjs.getDocument({
    ...source,
    disableAutoFetch: true,
    disableStream: true,
  });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: COVER_WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.min(Math.round(viewport.height), COVER_WIDTH * 2); // very tall pages are cropped
    await page.render({ canvas, viewport }).promise;
    return looksLikeCover(inkShare(canvas)) ? await toJpeg(canvas) : null;
  } finally {
    await task.destroy();
  }
}

// Share of pixels that aren't near-white, sampled on a grid.
function inkShare(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 1;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let ink = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4 * 7) {
    total++;
    if (data[i] < 225 || data[i + 1] < 225 || data[i + 2] < 225) ink++;
  }
  return total ? ink / total : 1;
}

export function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/jpeg", 0.82));
}

// Uploads an image to Convex storage and returns its id.
export async function uploadImage(uploadUrl: string, image: Blob): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": image.type || "image/jpeg" },
    body: image,
  });
  if (!res.ok) throw new Error("cover upload failed");
  return (await res.json()).storageId as string;
}
