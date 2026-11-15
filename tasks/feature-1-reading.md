# Task: Feature 1, Reading experience
**Status:** in progress (slices 1–3, 4a and 4b built, awaiting review) · **Branch:** `feat/reading-experience` · **PR:** none

## Why
- **User problem:** Non-fiction readers read a book and don't learn it.
- **Outcome it serves:** the tools for reflection, application and testing, without getting in the way of reading (PRODUCT.md). This feature builds the reading surface those tools sit on.

## Acceptance criteria
The full list is **PRODUCT.md → Feature 1, sections A–E.** It isn't repeated here. "Done" means a reader can upload a real book, read it, mark it up, reflect, ask cited questions and find the test button, without the page ever feeling busy.

## Slices (one at a time; each ends with a browser check and your OK)
| # | Slice | Done when |
|---|---|---|
| 1 | **Upload + ingest** (A) | A PDF ≤25 MB uploads in-page with progress, is prepared (text, TOC, scan check), and the reader route opens. Bad files show plain messages |
| 2 | **Reader + Contents** (B, C-contents) | Pages render and scroll, zoom works, last page is restored, TOC jumps to exact pages, scans are readable |
| 3 | **Highlights + comments** (C) | Select → highlight → appears in page and panel, grouped by chapter, click jumps and flashes, survives reload |
| 4 | **Reflections** (D) | Chapter-end prompt, skippable, saved and editable in the right panel |
| 5 | **Chat** (D) | Cited short answers favoring the current chapter, "Summarize this chapter", 5/day limit |
| 6 | **Test tab** (E) | Small tab appears on scroll, collapses after 3 s, opens the placeholder page |

## Design
- No mockups yet. Research pointers: upload F05/F15/F17, left panel F01, highlights F07, chat F02–F04.
- **Before each slice, I propose its layout in a sentence or two (and a sketch if useful) for your OK.**

## Constraints
- **Cost:** no AI on upload. Chat only on request, 5/day/user, flash model through `llm.ts`.
- **Approved:** new tables (ARCHITECTURE.md → Data) and `pdfjs-dist`. Anything else new needs a fresh approval.
- **Out of scope:** see PRODUCT.md (quiz content, export, bookmarks, stats, OCR, other formats, library).

## Relevant files
- `convex/schema.ts`, `documents.ts`, `ingest.ts`, `sources/pdf.ts`, `chapters.ts`, `highlights.ts`, `reflections.ts`, `chat.ts`, `retrieval.ts`
- `app/` upload page, `read/[id]`, `read/[id]/test`; `components/reader/`
- Legacy upload code (`PdfDropzone.tsx`, `courses.ts`) is reference only; don't extend it.

## Verification
- [ ] **Tests (each rule):** upload size/type check, scan detection, page→chapter mapping, owner-only access for every new table, daily limit, chapter boost ranking, citation filter.
- [ ] **Browser, per slice, with real PDFs:** one near 25 MB, one scanned, one with no contents. Report what was seen.
- [ ] `npm test`, `npm run lint` (0 errors) before the PR.

## Status log
- 2026-11-14: Spec written. Schema tables and `pdfjs-dist` approved.
- 2026-11-14: **Slice 1 built.** Only `documents` and `chunks` tables added so far (others arrive with their slices). Deviations: `documents.create` returns `{ok, message}` instead of throwing on an oversize file, because a throw would roll back the file delete. Server-side the file is also checked for the `%PDF-` header. `pdfjs-dist` isn't installed yet (slice 2). Tested with generated PDFs (24 MB, 27 MB, scanned, no contents, with contents, fake) and one made by a real PDF engine. **Not yet tested with a real book that has a table of contents.**
- 2026-11-14: **Slice 4 scope changed by Hemanth.** Split into 4a (layout) and 4b (reflections). Layout: the left panel is now an overlay on the book; the right panel pushes the book, starts at 1/3 of the window, is draggable up to 60% and remembers its width, with a Chat | Reflections switch. Reflection notes are rich text (Tiptap, approved), Gmail-style: fill the right panel, **Expand** floats a larger note over the book, **Minimize** returns it. The note has a **Validate** button (AI checks the note against the book and corrects it; counts toward the 5/day; built with chat in slice 5). The old "Test my understanding" idea is replaced by Validate.
- 2026-11-14: **Slice 4b built** (reflections). `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` added (approved). New `reflections` table (with the small `dismissed` addition, as proposed). The note is rich text (bold, italic, bullets, numbered lists), autosaves ~0.8 s after typing stops, one per chapter, and an empty note deletes the reflection. It fills the right panel; **Expand** opens a larger window over the book and **Minimize** (button, Esc or clicking outside) returns it; the text carries across. The end-of-chapter card appears only when reading naturally past a chapter's last page (a jump never triggers it), **Not now** is remembered, and a card left alone tucks away after 15 s and leaves a dot on the Reflect button. No contents means no chapters, so the panel says reflections aren't available. **Validate is not built yet** (needs chat and AI, slice 5). Checked in the browser on the 300-page book: write with bold, italic and bullets; autosave shows Saved; expand and minimize keep the text; list shows the reflection; reading through the end of Chapter 1 showed the card; Not now stored a dismissed row. **Not tested:** the 15-second tuck and dot, numbered lists by hand, a very long note, two tabs editing the same note.
- 2026-11-14: **Slice 4a built.** Checked in the browser: overlay opens without moving the book; right panel opens at 360 px (1/3 of this 1024 px window is below the 360 minimum); drag and arrow keys resize it and the book re-fits; width survives reload; Esc closes the left overlay first, then the right panel; clicking the book or choosing a contents entry closes the overlay; Chat is hidden for a scanned PDF. Chat and Reflections tabs hold placeholders until 4b and slice 5. **Not tested:** a wide window (the 1/3 default), touch.
- 2026-11-14: **Slice 3 built** (highlights + comments). Deviations from PRODUCT.md: the selection menu has **Highlight** and **+ Comment** only; **Ask AI** is coded into the menu but hidden until chat exists (slice 5), since the right panel isn't built. Selections can cross a page break (stored as `segments`, one per page; the panel jumps to the first page). Added the `highlights` table, `highlights.ts`, `highlightRules.ts`, `chapterOf`. Left rail now has two buttons (Contents, Highlights with a count badge) instead of tabs inside the panel. Checked in the browser on the 300-page book: highlight, cross-page highlight, comment (Enter saves), group under the chapter, jump + flash, zoom keeps marks aligned, reload keeps them, delete, scanned PDF hides Highlights. **Not tested:** delete of a highlight with a comment (it asks to confirm), real mouse drag, a real book, two-column pages, text with unusual fonts.
- 2026-11-14: **Slice 2 built** (reader + Contents). Added `documents.fileUrl`, `documents.saveProgress`, `chapters.ts` (current contents entry for a page). `pdfjs-dist` 6.5.438 installed. Checked in the browser with a generated 300-page book: TOC jump lands exactly on the page in ~170 ms, zoom 100→150% keeps the page, last page restores after reload, text is selectable, a scan is readable with a note, and an empty TOC says "No contents found". Fixed while testing: page-visibility reports can arrive in batches, so the latest one is used. **Not yet tested with a real book, with mixed page sizes, or on a very slow connection.** Zoom snaps to the top of the current page.
