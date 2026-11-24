import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { buildBookExport } from "./exportRules";

export const notebookFor = internalQuery({
  args: {
    documentId: v.id("documents"),
    options: v.optional(v.object({ notes: v.boolean(), highlights: v.boolean(), saved: v.boolean() })),
  },
  handler: async (ctx, { documentId, options }) => {
    const book = await ctx.db.get(documentId);
    if (!book) throw new Error("Book not found.");
    const [notes, highlights, saved] = await Promise.all([
      ctx.db.query("notes").withIndex("by_document", (q) => q.eq("documentId", documentId)).collect(),
      ctx.db.query("highlights").withIndex("by_document", (q) => q.eq("documentId", documentId)).collect(),
      ctx.db.query("savedQuestions").withIndex("by_document", (q) => q.eq("documentId", documentId)).collect(),
    ]);
    return buildBookExport({
      book,
      notes,
      highlights,
      saved: saved.map(({ chapterKey, question, yourAnswer, rightAnswer, page, _creationTime }) => ({
        chapterKey, question, yourAnswer, rightAnswer, page, _creationTime,
      })),
      options,
    });
  },
});
