# Task: Feature 2, Library, chapter path and tests
**Status:** approved 2026-11-17, building in slices · **Branch:** `feat/library-and-path` · **PR:** none

## Why
- **User problem:** a reader has nowhere to see their books, no sense of progress through a book, and no way to test themselves.
- **Outcome it serves:** reflection and testing that feel **fun and meaningful**, without intruding on reading (PRODUCT.md).

## Design
Agreed in the local prototype, mockup 3: `.context/compound-engineering/ce-prototype/2026-11-16-reader-ux/01-layout-desk-vs-journey/screens/003-full-flow.html` (gitignored). Decisions are in that run's `decisions.md`.

## Acceptance criteria

### A. Home (your books)
- [ ] Opening the app shows **Continue reading** (last book: title, chapter, page, % done) and a **shelf of every uploaded book** (title, "p. 212 of 344 · Ch 10", progress line). Newest-read first; sort by Title or Progress.
- [ ] **Upload is in the first screen:** an "Add a new book" drop zone beside Continue reading (drop a PDF or click), plus a tile at the end of the shelf. Same upload rules as Feature 1.
- [ ] Covers are **plain colours** with the title (no cover rendering; uploads stay fast).
- [ ] Each book has a **⋯ menu** (shows on hover or keyboard focus) with **Rename** (inline) and **Remove from library** (asks to confirm; deletes the book and its highlights, notes, chat and test results; can't be undone).

### B. Chapter path (one book)
- [ ] Clicking a book opens its **path**: chapters as stops along a dotted trail. Each stop shows **% read** and three markers: **📖 Read**, **✏️ Notes**, **💡 Test** (the test shows the best score, e.g. "4/5"). A marker turns **green with ✓** when done.
- [ ] **Every marker is clickable:** Read opens the chapter, Notes opens its note, Test starts its test.
- [ ] The current chapter's circle fills as it's read. No extra "Keep reading" button on the path (Continue reading lives in the side card).
- [ ] **No table of contents:** the path is made of **parts of 20 pages** each.
- [ ] The side card shows the book's overall progress, the reader's **level and XP**, and **Continue reading**.

### C. Reader (changes from Feature 1)
- [ ] **Top menu hides while reading** and reappears when the mouse moves. It holds ← **Path**, ☰ **Contents** and **📚 Study tools**.
- [ ] **Contents** opens as a collapsible **left panel** (cream, letter-spaced CONTENTS header, dotted leaders, page numbers; ✓ on finished chapters).
- [ ] **📚 Study tools** toggles a **right drawer** with tabs **✨ Ask · ✏️ Notes · 🖍 Highlights · 🧰 More**. More lists **Practice questions, Mind map, Flashcards** marked **Coming soon**.
- [ ] The selection menu (Highlight, Add comment, Ask) and the page/zoom pill stay as built.
- [ ] **End of chapter:** a card at the end of the chapter's text (not a pop-up) offers **✏️ Write a note** and **💡 Test yourself**, and shows the XP for each.

### D. Test yourself
- [ ] **5 multiple-choice questions** (4 options) made from the chapter's text, in the retro game look: progress bar, hearts, XP.
- [ ] After each answer: right or wrong, a short explanation, and for a wrong answer why it was tempting.
- [ ] The end screen shows the score (e.g. 4/5), XP earned and **Review missed questions** (re-asks only the ones missed).
- [ ] The best score shows on the chapter's Test marker.

### E. XP, levels, streak (simple, started fresh)
- [ ] **Reading a chapter: 10 XP.** **A note: 20 XP.** **Each right answer: 10 XP.**
- [ ] **Level** goes up every 100 XP. **Streak** counts days in a row with any XP. No stars.

## Slices (one at a time; each ends with a browser check)
| # | Slice | Done when |
|---|---|---|
| 1 | **Earthy look + Home** (A) | The app uses the earthy palette and fonts. `/read` shows Continue reading, the upload drop zone and the shelf, and rename/remove work |
| 2 | **Chapter path + % read** (B) | `/read/[id]` shows the path (or 20-page parts). Pages seen are recorded, and % read and Read ✓ are correct |
| 3 | **Reader layout** (C) | Auto-hiding top menu, left Contents panel, Study tools drawer, end-of-chapter card. The old dock and rails are gone |
| 4 | **Test yourself** (D) | 5 generated questions, scoring on the server, review missed, best score on the path |
| 5 | **XP, level, streak** (E) | XP awarded once per action on the server, and level and streak shown on Home and the path |

## Constraints
- **Cost:** a test is one AI call per chapter the first time, and it uses one of the 5 daily AI questions. Retakes and reviews reuse the stored questions and are free.
- **Schema changes need approval** (see ARCHITECTURE.md → Feature 2).
- **Out of scope:** stars, spaced review, practice questions / mind map / flashcards (placeholders only), generated covers, mobile.

## Answers (Hemanth, 2026-11-17)
1. **XP:** 10 / 20 / 10 per right answer, a level every 100 XP. Accepted.
2. **A chapter's first test uses one of the 5 daily AI questions;** retakes don't. Accepted.
3. **% read = pages seen** (2 s on screen during normal reading). Accepted.
4. **A chapter is "Read" only at 100%:** every page of it seen.
5. **Schema changes in ARCHITECTURE.md → Feature 2 approved** ("proceed with build").

## Verification
- [ ] Tests for: XP rules, level and streak, % read per chapter, 20-page parts, test scoring and answer keys staying on the server, rename/remove owner-only, remove deleting everything for that book.
- [ ] Browser check with real PDFs (with and without contents), every box above.

## Status log
- 2026-11-17: **Slice 1 built** (earthy look + Home). App-wide tokens switched to the earthy palette (one light theme, dark mode dropped for now) and fonts to Literata / Work Sans / Silkscreen via `next/font` (no new dependency). `/read` is now Home: Continue reading, the "Add a new book" drop zone in the first screen, and a shelf with plain-colour covers, sort (Recent, Title, Progress), search, and a ⋯ menu with Rename and Remove. Backend: `documents.list`, `rename`, `remove` (book disappears at once; file, pages, highlights, notes and chat deleted in background batches), and a `lastReadAt` field so the shelf orders by recent reading. Deviation: progress on Home is page-based (last page ÷ pages) until slice 2 adds pages seen; the test-score part of "Remove" arrives with tests. "View chapter path" is hidden until slice 2. Browser check: Home with real test books, a rename, a remove with its confirm, and an upload from the drop zone that opened the reader. **Not tested:** drag-and-drop with a real mouse, a library of 50+ books.
- 2026-11-17: Spec written from mockup 3 and Hemanth's answers. Branch created from `feat/reading-experience`, carrying the uncommitted UX round 1 work (icon menu, page pill, chapter dock). The dock is replaced by C above.
