# 016. Library folders: one folder per item, deleting a folder keeps its items
**Date:** 2026-11-21 · **Status:** accepted (Feature 4)

**Context:** Readers group books, articles, talks and documents by project or topic. Home's primary actions (Continue reading, Add to your library) must stay first; folders are secondary (prototype 008, layout C).
**Decision:**
- New `folders` table (`userId`, `name`, `colour`, `emoji`); `documents.folderId` is optional (none = "No folder"), indexed `by_folder`. Any source type can go in any folder.
- **One folder per item**, like files on a computer. Simpler to reason about than tags; tags can come later if people want an item in two places.
- **Deleting a folder never deletes items:** they move to No folder and the ids come back for Undo (Undo recreates the folder and moves them back). Every move offers Undo.
- `folders.moveItems` is all-or-nothing and owner-only for both the items and the target folder. Adding (PDF, EPUB/Word/PowerPoint, links) accepts an optional `folderId`; a folder that isn't the reader's, or was deleted mid-upload, is ignored and the item lands in No folder rather than failing.
- Names are 1–40 characters, unique per reader ignoring case; up to 100 folders; listed alphabetically so a folder keeps its place.
- Filtering by folder happens in the browser over `documents.list` (a library is ≤500 items); search looks across every folder.
**Why:** Smallest model that covers "group my library" with no risk to reading data. Cost: no nesting, no multi-folder items yet.
