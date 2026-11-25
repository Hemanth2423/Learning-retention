// Pure rules for library folders (ADR 016). Shared by the browser (instant feedback) and the server.

export const MAX_FOLDERS = 100;
export const MAX_FOLDER_NAME = 40;
export const MAX_MOVE_AT_ONCE = 200;
export const MAX_FOLDER_DEPTH = 4; // a folder, inside a folder, inside a folder, inside a folder

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

// ---- Nested folders ----
export type FolderNode = { _id: string; name: string; parentId?: string | null };

export function childrenOf<T extends FolderNode>(folders: T[], parentId: string | null): T[] {
  return folders.filter((f) => (f.parentId ?? null) === parentId).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

// The folder's ancestors from the top down, ending with the folder itself. Stops safely on bad data.
export function folderPath<T extends FolderNode>(folders: T[], id: string): T[] {
  const byId = new Map(folders.map((f) => [f._id, f]));
  const path: T[] = [];
  const seen = new Set<string>();
  for (let f = byId.get(id); f && !seen.has(f._id); f = f.parentId ? byId.get(f.parentId) : undefined) {
    seen.add(f._id);
    path.unshift(f);
  }
  return path;
}

export function descendantIds(folders: FolderNode[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (p: string) => {
    for (const f of folders) if ((f.parentId ?? null) === p && !out.has(f._id)) { out.add(f._id); walk(f._id); }
  };
  walk(id);
  return out;
}

// How many levels the folder and everything inside it take up (1 = no subfolders).
export function subtreeHeight(folders: FolderNode[], id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  return 1 + Math.max(0, ...folders.filter((f) => f.parentId === id).map((f) => subtreeHeight(folders, f._id, seen)));
}

// Why a folder can't move under this parent (null = top level), or undefined.
export function moveFolderProblem(folders: FolderNode[], id: string, parentId: string | null): string | undefined {
  if (parentId === null) return undefined;
  if (parentId === id || descendantIds(folders, id).has(parentId)) return "A folder can't go inside itself.";
  if (folderPath(folders, parentId).length + subtreeHeight(folders, id) > MAX_FOLDER_DEPTH) return `Folders can go ${MAX_FOLDER_DEPTH} levels deep.`;
  return undefined;
}

export function canHaveSubfolder(folders: FolderNode[], id: string): boolean {
  return folderPath(folders, id).length < MAX_FOLDER_DEPTH;
}

// The tree in display order, each folder with its depth (0 = top level).
export function flattenFolders<T extends FolderNode>(folders: T[]): (T & { depth: number })[] {
  const out: (T & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of childrenOf(folders, parent)) {
      out.push({ ...f, depth });
      walk(f._id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// Items in this folder and all its subfolders.
export function totalInFolder(folders: FolderNode[], byFolder: Map<string, number>, id: string): number {
  let n = byFolder.get(id) ?? 0;
  for (const d of descendantIds(folders, id)) n += byFolder.get(d) ?? 0;
  return n;
}

// A name free among `others`: "Notes", then "Notes (2)". Used when deleting a folder lifts its subfolders up a level.
export function uniqueFolderName(name: string, others: string[]): string {
  const taken = new Set(others.map((o) => o.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const suffix = ` (${i})`;
    const candidate = name.slice(0, MAX_FOLDER_NAME - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
