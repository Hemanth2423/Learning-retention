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
- 2026-11-17: **More slice 3 fixes.** Chapter numbers now come from the book's own titles ("Chapter 8: …" shows 8 on the path and "END OF CHAPTER 8"), not their position; unnumbered entries show "•", parts "P3". Shouty titles keep common acronyms (URL, API, SQL…). Notes list: one 14 px text size, the picker arrow sits inside the box, previews show 2 lines with the empty lines from lists removed. **Images in notes** (`@tiptap/extension-image`, approved): an Add image button in the toolbar, images up to 5 MB, stored per book in a new `noteImages` table and deleted with the book; a note with only an image still counts as written. Browser check: notice read "END OF CHAPTER 1", previews clamp to 2 lines, an image uploaded and saved into Chapter 1's note. **Not tested:** a very large image, pasting or dragging an image into the note (only the button is supported).
- 2026-11-17: **Slice 3 fixes (Hemanth's review).** Notes toolbar is Docs-style: Normal text / Heading / Subheading, Bold, Italic, Underline, Strikethrough, bullet and numbered lists (Tiptap StarterKit, no new package); "Check against the book" moved under the note. **Add image is not built yet: it needs `@tiptap/extension-image` (new dependency, asked).** Contents: smaller sans text, "8 · Title" numbering pulled from "Chapter 8: …", ● on the current chapter, ✓ on read ones, two-line ellipsis with the full title on hover. Notes panel: warmer cards, readable titles, the chapter picker defaults to the chapter being read. End of chapter: no longer between pages; a closable card at the bottom appears once a chapter's last page has been on screen 2 s (once per chapter per visit). Citations show as "p.214" chips. Deleting a highlight with a comment uses the app's own confirm dialog. Study tools: a title row with ✕, then one segmented control (icon over label). Browser check: notice on Chapter 1's last page, Contents numbering and current dot, segmented tabs, Notes cards and picker on Chapter 1, the new toolbar, p.N chips in chat. **Not tested:** the delete confirm, headings and strikethrough typed by hand.
- 2026-11-17: **Slice 3 built** (reader layout). The top menu (← Path, ☰ Contents, the chapter name with its read bar, 📚 Study tools) hides 2.5 s after the mouse stops and comes back on movement; it stays while a panel is open. Contents is a cream left panel with dotted leaders, page numbers and ✓ on chapters read (parts when there are no contents). Study tools is the right drawer (still resizable) with ✨ Ask · ✏️ Notes · 🖍 Highlights · 🧰 More (Practice questions, Mind map, Flashcards: SOON). The end-of-chapter card sits between pages after each chapter's last page, with ✏️ Write a note (opens that chapter's note) and 💡 Test yourself. Removed: the left and right rails, the bottom-right chapter dock, and the "finished a chapter" detection that only the dock used (its tests went with it). Deviation: XP amounts on the card arrive with slice 5. Jumps now leave 76 px for the menu. Browser check: menu hides and reappears, Contents with ✓ on Chapter 1, Write a note opened Chapter 1's note in the drawer, More shows the three SOON tools, the card sits between Chapter 1 and Chapter 2. **Not tested:** a real book, keyboard-only use of the menu, a narrow window.
- 2026-11-17: **Slice 2 fixes (Hemanth):** a chapter's Read marker opens where the reader left it (the last page, if it's in that chapter, otherwise the first unread page, or the start once all read; `resumePage`, tested). The path opens scrolled to the reader, with the current chapter second from the top. Continue reading always restores the last page.
- 2026-11-17: **Slice 2 built** (chapter path + % read). Routes: `/read/[id]` is now the path, the reader moved to `/read/[id]/book` (`?page=N` opens a chapter, `&notes=KEY` opens its note), and uploads land on the path. `documents.pagesSeen` (one character per page) is filled by the reader: a page counts once it's mostly on screen (half the page or 40% of the view) for 2 s, saved every 3 s and when leaving. Chapter % = pages seen ÷ chapter pages, Read ✓ only at 100%. Books without contents get 20-page parts (`partRanges`); parts also work for notes and summaries. Home progress now uses pages seen, and the Continue reading card has "View chapter path". The test marker links to the placeholder until slice 4. Changed test on purpose: "no contents" now gives parts instead of no chapters (ADR 008). Browser check: the long book's path (10 chapters, Notes ✓ where a note exists), opening Chapter 3 from its marker at page 61 and reading it moved "You're here" to Chapter 3 at 3%, reading all 3 pages of habits Chapter 1 turned it green "Read 100% ✓" and "1 of 3 chapters read", and a 45-page PDF with no contents showed Parts 1–3. Fixed while testing: "You're here" now moves to the next unread chapter once the current one is finished. **Not tested:** a real book, very fast scrolling, two tabs on the same book.
- 2026-11-17: **Slice 1 built** (earthy look + Home). App-wide tokens switched to the earthy palette (one light theme, dark mode dropped for now) and fonts to Literata / Work Sans / Silkscreen via `next/font` (no new dependency). `/read` is now Home: Continue reading, the "Add a new book" drop zone in the first screen, and a shelf with plain-colour covers, sort (Recent, Title, Progress), search, and a ⋯ menu with Rename and Remove. Backend: `documents.list`, `rename`, `remove` (book disappears at once; file, pages, highlights, notes and chat deleted in background batches), and a `lastReadAt` field so the shelf orders by recent reading. Deviation: progress on Home is page-based (last page ÷ pages) until slice 2 adds pages seen; the test-score part of "Remove" arrives with tests. "View chapter path" is hidden until slice 2. Browser check: Home with real test books, a rename, a remove with its confirm, and an upload from the drop zone that opened the reader. **Not tested:** drag-and-drop with a real mouse, a library of 50+ books.
- 2026-11-17: Spec written from mockup 3 and Hemanth's answers. Branch created from `feat/reading-experience`, carrying the uncommitted UX round 1 work (icon menu, page pill, chapter dock). The dock is replaced by C above.
