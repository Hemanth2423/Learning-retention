// Pure rules for library folders (ADR 016). Shared by the browser (instant feedback) and the server.

export const MAX_FOLDERS = 100;
export const MAX_FOLDER_NAME = 40;
export const MAX_MOVE_AT_ONCE = 200;

// Earthy colours that sit with the library's covers; a new folder takes the next one.
export const FOLDER_COLOURS = ["#a8492a", "#4c6a47", "#443e58", "#6d6038", "#94532e", "#31483f", "#563238", "#5e3b27"];
export const DEFAULT_FOLDER_EMOJI = "📁";

export const normalizeFolderName = (name: string) => name.replace(/\s+/g, " ").trim();

// Why a name can't be used, or undefined. `others` are the reader's other folder names.
export function validateFolderName(name: string, others: string[]): string | undefined {
  const n = normalizeFolderName(name);
  if (!n) return "Give the folder a name.";
  if (n.length > MAX_FOLDER_NAME) return `Keep the name under ${MAX_FOLDER_NAME} characters.`;
  if (others.some((o) => o.toLowerCase() === n.toLowerCase())) return `You already have a folder called “${n}”.`;
  return undefined;
}

export function nextFolderColour(existing: number): string {
  return FOLDER_COLOURS[existing % FOLDER_COLOURS.length];
}

// A folder's emoji: one emoji, or the default (keeps names and icons from being misused for long text).
export function cleanEmoji(emoji: string | undefined): string {
  const e = (emoji ?? "").trim();
  if (!e) return DEFAULT_FOLDER_EMOJI;
  const chars = [...e];
  return chars.length <= 4 && !/[A-Za-z0-9<>]/.test(e) ? e : DEFAULT_FOLDER_EMOJI;
}

// Library items in book order for a folder view: "all", "none" (no folder) or a folder id.
export function inFolder<T extends { folderId: string | null }>(items: T[], view: string): T[] {
  if (view === "all") return items;
  if (view === "none") return items.filter((i) => !i.folderId);
  return items.filter((i) => i.folderId === view);
}

export function folderCounts(items: { folderId: string | null }[]): { all: number; none: number; byFolder: Map<string, number> } {
  const byFolder = new Map<string, number>();
  let none = 0;
  for (const i of items) {
    if (!i.folderId) none++;
    else byFolder.set(i.folderId, (byFolder.get(i.folderId) ?? 0) + 1);
  }
  return { all: items.length, none, byFolder };
}
