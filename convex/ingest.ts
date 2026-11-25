"use node";

// Prepares an uploaded document for reading. Plain code, no AI (see decisions/005).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { documentTitle, hasReadableText } from "./documentRules";
import { readPdf } from "./sources/pdf";

const BATCH = 40; // pages saved per write

function friendlyError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "PasswordException") return "This PDF is password-protected. Remove the password and try again.";
  return "We couldn't read this PDF. It may be damaged. Try exporting it again.";
}

export const run = internalAction({
  args: { documentId: v.id("documents"), fileName: v.string() },
  handler: async (ctx, { documentId, fileName }) => {
    try {
      const doc = await ctx.runMutation(internal.documents.getForIngest, { documentId });
      if (!doc?.fileId) return;
      const blob = await ctx.storage.get(doc.fileId);
      if (!blob) throw new Error("missing file");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      // Re-check the file really is a PDF, whatever the browser claimed.
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
        await ctx.runMutation(internal.documents.markFailed, {
          documentId,
          message: "That file isn't a PDF. Choose a PDF and try again.",
        });
        return;
      }

      const { metaTitle, pages, sections } = await readPdf(bytes);
      const hasText = hasReadableText(pages);
      if (hasText) {
        for (let start = 0; start < pages.length; start += BATCH) {
          await ctx.runMutation(internal.documents.saveChunks, {
            documentId,
            userId: doc.userId,
            startIndex: start,
            pages: pages.slice(start, start + BATCH),
          });
        }
      }
      await ctx.runMutation(internal.documents.markReady, {
        documentId,
        title: documentTitle(metaTitle, fileName),
        pageCount: pages.length,
        hasText,
        sections: sections.map((s) => ({ key: s.key, title: s.title, level: s.level, locator: { kind: "pdf" as const, page: s.page } })),
      });
    } catch (err) {
      console.error("[ingest] failed", err);
      await ctx.runMutation(internal.documents.markFailed, { documentId, message: friendlyError(err) });
    }
  },
});
