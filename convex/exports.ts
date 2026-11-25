import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { buildNotebookExport } from "./exportRules";

export const notebookFor = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const book = await ctx.db.get(documentId);
    if (!book) throw new Error("Book not found.");
    const notes = await ctx.db.query("notes").withIndex("by_document", (q) => q.eq("documentId", documentId)).collect();
    const highlights = await ctx.db.query("highlights").withIndex("by_document", (q) =>
      q.eq("documentId", documentId)).collect();
    return buildNotebookExport({
      title: book.title,
      sections: book.sections ?? [],
      pageCount: book.pageCount ?? 0,
      notes,
      highlights,
    });
  },
});
