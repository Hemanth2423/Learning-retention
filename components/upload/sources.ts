// What a reader can add. Only PDF for now. Links, YouTube and other formats become new entries here
// (plus an adapter in convex/sources/), and the upload page picks them up.
export const SOURCES = [
  { type: "pdf", label: "Upload PDF", hint: "PDF · up to 25 MB", accept: "application/pdf,.pdf" },
] as const;
