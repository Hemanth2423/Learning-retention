import { Infer, v } from "convex/values";

// "Where something is" in a document. Highlights, reflections and citations store these
// instead of PDF-only fields, so new formats add a kind here (e.g. video time) and nothing else changes.
export const locator = v.union(
  v.object({ kind: v.literal("pdf"), page: v.number() }) // page is 1-based
);

export type Locator = Infer<typeof locator>;
