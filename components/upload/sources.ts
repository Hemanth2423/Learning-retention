import { KIND_LABEL, kindOfFile } from "@/convex/textSourceRules";

// What a reader can add from the Files tab. Links (articles, YouTube) are in the Links tab.
export const MAX_FILES_AT_ONCE = 20;
export const FILE_ACCEPT = ".pdf,.epub,.docx,.pptx,application/pdf,application/epub+zip";
export const FILE_HINT = "PDF · EPUB · Word · PowerPoint · up to 25 MB each · up to 20 at once";
export const FILE_KINDS = ["PDF", "EPUB", "Word", "PowerPoint"];

export function fileKindLabel(name: string): string {
  const kind = kindOfFile(name);
  return kind ? KIND_LABEL[kind] : (name.toLowerCase().split(".").pop() ?? "").toUpperCase() || "File";
}

// A heads-up shown under a file before it's added (not an error).
export function fileNote(name: string): string | undefined {
  if (kindOfFile(name) === "powerpoint") return "Slide text only for now; pictures won't show. To keep the slides, save as PDF in PowerPoint.";
  return undefined;
}
