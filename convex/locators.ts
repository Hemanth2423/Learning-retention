import { Infer, v } from "convex/values";

// "Where something is" in a document. Highlights, reflections and citations store these
// instead of PDF-only fields, so new formats add a kind here (e.g. video time) and nothing else changes.
export const locator = v.union(
  v.object({ kind: v.literal("pdf"), page: v.number() }), // page is 1-based
  // Articles (and later EPUB/Word): "page" is the 1-based block number of the cleaned text, so everything that
  // works per page (chunks, Ask, citations, chapter ranges) works unchanged. See decisions/012.
  v.object({ kind: v.literal("text"), page: v.number() })
);

export type Locator = Infer<typeof locator>;
