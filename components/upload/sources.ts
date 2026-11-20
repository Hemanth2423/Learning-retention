// What a reader can add from the Files tab. Links (articles, YouTube) are in the Links tab.
export const MAX_FILES_AT_ONCE = 20;
export const FILE_ACCEPT = "application/pdf,.pdf";
export const FILE_HINT = "PDF · up to 25 MB each · up to 20 at once";
export const FILE_KINDS = ["PDF"];

export function fileKindLabel(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return ext === "pdf" ? "PDF" : ext.toUpperCase() || "File";
}
