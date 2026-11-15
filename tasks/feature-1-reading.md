# Task: Feature 1, Reading experience
**Status:** ready · **Branch:** `feat/reading-experience` (not created yet) · **PR:** none

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
