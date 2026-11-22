# Task: Folders in the library
**Status:** in progress · **Branch:** `feat/folders` (stacked on `feat/feature-3-rest`) · **PR:** —

## Why
- **User problem:** a library of books, articles, talks and documents gets hard to scan; readers group by project or topic ("Work · AI evals", "Habits").
- **Outcome it serves:** keeping what you learn findable (PRODUCT.md), without adding friction to adding and reading.

## Acceptance criteria
- [x] Home keeps **Continue reading** and **Add to your library** full width and unchanged at the top (they stay the primary actions).
- [x] Beside **Your library** a folder rail lists All items, each folder with a count, No folder, and **+ New folder** (inline name). On phones the rail becomes a row of chips.
- [x] Any item (PDF, EPUB, Word, PowerPoint, article, video) can go in any folder; one folder per item.
- [x] File an item by **dragging it onto a folder**, by **right-click → Move to**, or from the tile's **⋯ → Move to** (keyboard-friendly). Each move shows a toast with **Undo**.
- [x] Opening a folder filters the shelf (filters, sort and search still work) and the Add card says **"Goes into <folder>"**; the Add sheet's **Add to** picker defaults to it, and new files and links land there. Files dropped from the computer onto a folder open the Add sheet aimed at that folder.
- [x] A folder can be renamed or deleted; **deleting never deletes items**: they move to No folder, with Undo.
- [x] Names: 1–40 characters, no duplicates (case-insensitive) per reader; up to 100 folders.
- [x] Everything is owner-only: you can't see, rename, delete or fill someone else's folder, or move someone else's item.

## Design
Prototype 008, layout C (local, gitignored: `.context/compound-engineering/ce-prototype/2026-11-21-folders-and-practice/screens/008-home-with-folders.html`), chosen by Hemanth 2026-11-21.

## Constraints
- **Schema:** new `folders` table, `documents.folderId` (approved by Hemanth with "build it out", 2026-11-21; ADR 016).
- **Out of scope:** an item in two folders (tags), shared folders, reordering folders.

## Verification
- [x] Tests: name rules; create/rename/delete; move (owner checks on item and folder); delete keeps items; adding into a folder (PDF, text files, links); data isolation.
- [x] Browser: create, drag, right-click and ⋯ moves, Undo, rename, delete + Undo, filters + search inside a folder, Add into a folder (file and link), drop files on a folder, phone width.

## Status log
- 2026-11-22: **UX round from Hemanth, built:** nested folders (4 levels), New folder pop-up, playlist-style + Add items, empty-folder actions, playlists as folders (needs `YOUTUBE_API_KEY`), whole-image covers, solid Add card and calmer Home, capped titles, cleaned article view with paywall notice and Reader | Original, Notebook 2-line caps + icons, exact PDF selection, memoised pages, one soft-white reading canvas. ADR 017. **Not tested live:** a real playlist (no key yet; covered with mocked API tests), a real paywalled article in the browser (covered by tests on Lenny's text).
- 2026-11-21: **Built and browser-checked** (layout C). Tested: make folders (duplicate name refused), drag onto a folder (rail highlights targets), right-click and ⋯ → Move to for PDF, EPUB, article, PowerPoint and video, Undo, folder view with kind filters, search across folders (resets the kind filter, shows each item's folder), rename, delete (items to No folder) + Undo, Add sheet preset to the open folder (YouTube link landed in it), files dropped on a folder (PDF + EPUB landed in it), phone width (heading → folder chips → shelf, no sideways scroll), keyboard path via ⋯. 11 server tests. **Deviations:** folders are listed alphabetically (keeps order stable after Undo); search ignores the open folder on purpose.
- 2026-11-21: Spec written from prototype 008 (layout C).
