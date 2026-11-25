# Task: Feature 1, Reading experience
**Status:** in progress (all 6 slices built, awaiting Hemanth's review) · **Branch:** `feat/reading-experience` · **PR:** none

## Why
- **User problem:** Non-fiction readers read a book and don't learn it.
- **Outcome it serves:** the tools for reflection, application and testing, without getting in the way of reading (PRODUCT.md). This feature builds the reading surface those tools sit on.

## Acceptance criteria
Moved here from PRODUCT.md on 2026-11-17. "Done" means a reader can upload a real book, read it, mark it up, reflect, ask cited questions and find the test button, without the page ever feeling busy.

> **Partly replaced by Feature 2:** the layout in C (left overlay), D (Chat | Reflections switch) and E (bottom-right chapter card) changes to the agreed flow in [feature-2-library-and-path.md](feature-2-library-and-path.md). Everything else still holds.

**Goal:** Upload a PDF and read it in a calm page, with contents, highlights, reflections and cited chat one click away.
**UX principle:** decluttered and simple. Panels stay closed until asked for.
**Research pointers (local):** upload F05, F15, F17 · left panel F01 · highlights + comments F07 · chat F02–F04.

#### A. Upload
- [ ] The upload page has **one action: Upload PDF** (click, or drag and drop from the laptop). It asks nothing about quizzes or outputs.
- [ ] Accepts **PDF up to 25 MB**. A wrong type, a file over 25 MB, or an unreadable or password-protected file shows a plain message saying what to fix. Nothing is stored.
- [ ] Upload happens **in the page** (no modal) with a clear loading state: *Uploading (with %)* → *Preparing your book*. When ready, **the reader opens automatically.**
- [ ] If preparation fails, the page says so and offers **Try again**. No half-made documents are left behind.
- [ ] Built around a **source type** (PDF today). Links, YouTube or other formats can be added later as new options. Only PDF shows now.
- [ ] No document library. The upload page shows a quiet **Continue reading** link to the latest book. *(Assumed, not yet confirmed.)*

#### B. Reader
- [ ] The PDF shows as readable pages: sharp, selectable text and scrolling. A **floating pill at the bottom** of the book has ‹ previous, a **page box** ("12 of 240", type a number and press Enter to go there), › next, and − / + zoom. Each control names itself on hover.
- [ ] Reopening a document returns the reader to the last page they were on.
- [ ] **Scanned (image-only) PDF:** reading works. Highlights and chat are switched off, with a one-line note saying why.
- [ ] Nothing competes with the page: panel buttons sit on the edges, plus the test button (E).

#### C. Left panel: Contents and Highlights
- [ ] **Collapsed by default**, with an always-visible edge button (icon + label). Opening it shows the panel as an **overlay on top of the book's left edge**, so the page doesn't move. It closes on Esc, on clicking the book, or after choosing a contents entry.
- [ ] **Contents:** shows the PDF's table of contents, nested. Clicking an entry goes to **that exact page**. The current chapter is marked. No table of contents → "No contents found".
- [ ] **Highlights:** dragging the cursor over text shows a small **icon-only** menu: **Highlight**, **Add comment** and **Ask AI** (puts the selected text in the chat). Each icon shows its name as soon as the pointer is over it. The highlight shows in the page and in the panel at once. A selection can cross a page break.
- [ ] A comment is optional. It can be added, edited or deleted at any time, and shows under its highlight in the panel.
- [ ] The panel groups highlights **by chapter**, in reading order.
- [ ] Clicking a highlight in the panel goes to **its exact spot** in the page (its first page, if it crosses a break) and briefly flashes it.
- [ ] Highlights and comments are saved per user and per document, and survive a reload. Only the owner can see them.

#### D. Right panel: Reflections and Chat
- [ ] **Collapsed by default**, with its own edge buttons (**Chat** and **Reflect**). Opening it **pushes the book over** (the book re-fits live). It starts at **one third of the window** (at least 360 px), and the reader can **drag its edge to widen it** up to about 60%. The width is remembered. Chat and Reflections share it through a **Chat | Reflections** switch, and it reopens on the last tab used. Esc closes it.
- [ ] **Reflection notes** are rich text (bold, italic, bullets, numbered lists). In the panel the note fills the panel, Gmail-style. **Expand** opens it larger over the book, and **Minimize** returns it to the panel. A **Validate** button checks the note against the book and corrects anything inaccurate. It counts toward the 5.
- [ ] **Reflections:** finishing a chapter opens the chapter card (E). Skipping never blocks reading. Saved reflections are listed by chapter and can be edited. *(Needs a table of contents; without one, no chapters.)*
- [ ] **Chat (this document only):** the reader asks and gets a **short answer, grounded in the PDF, with numbered citations**. It searches the whole book but **favors the chapter the reader is in**. Clicking a citation goes to the cited page. If the PDF doesn't contain the answer, it says so. *(Answer quality gets tuned later.)*
- [ ] **5 questions per user per day** (rolling 24 hours). The panel shows "3 left today"; at 0 it says when the next one frees up.
- [ ] **Ask AI** from selected text puts that text in the chat as the question. It counts toward the 5.
- [ ] **Quick replies** sit above the input, starting with **"Summarize this chapter"** (the chapter the reader is in). Quick replies count toward the 5. With no table of contents, it summarizes the current page and the next 4.
- [ ] Chat history is kept per document.

#### E. Chapter card: Reflect and Test yourself
- [ ] A small pill sits in the **bottom-right corner** of the book with **✏️ Reflect** and **❓ Test yourself**, plus a button to open the full card. Each icon names itself on hover.
- [ ] The reader can **open and collapse the card** at any time. It shows the chapter they're in, with **✏️ Reflect** and **❓ Test yourself** buttons.
- [ ] Finishing a chapter by reading **opens the card by itself** ("Chapter finished", the chapter name, *What did you take away?*). It **stays for 10 seconds** with a countdown bar, pauses while the pointer is on it, then collapses back to the pill with a dot on ✏️. Jumps never open it.
- [ ] Shouty all-caps chapter names are shown in title case so they're easy to read.
- [ ] **Test yourself** opens a new page, a "Coming soon" placeholder until the quiz is designed.

#### Constraints and scope
- **Desktop browsers only.** Uses the existing sign-in. Every record belongs to one user.
- **Source-agnostic core:** a document has a source type and readable chunks, so other formats can plug in later.
- **AI runs only when asked** (a chat message, "Summarize"), never on upload. Chat is capped at 5 per user per day.
- **Out of scope:** quiz content, Notion/Obsidian export, bookmarks, reading stats, OCR for scanned PDFs, formats other than PDF, a document library.
- **Verified by:** uploading a real PDF (one near 25 MB, one scanned, one with no contents) and walking through every box above in the browser. Report what was seen.



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
- 2026-11-15: **UX audit round 1** (from Hemanth's review with a real book). (1) Selection menu is icon-only (highlighter, comment, sparkle) with instant tooltips. (2) The header's page counter and zoom moved to a **floating pill** at the bottom of the book: ‹, a page box ("4 of 9", type and Enter), ›, −, +. (3) The bottom-centre test tab and the old end-of-chapter card are replaced by a **chapter dock** in the bottom-right: a pill with ✏️ Reflect, ❓ Test yourself and an expand button; the card can be opened and collapsed by the reader; finishing a chapter opens it for 10 s with a countdown (paused on hover), then it collapses with a dot on ✏️. "Test your understanding" is renamed **Test yourself**. All-caps chapter names show in title case. "Not now" is gone: collapsing is the "not now". Removed `TestTab.tsx`, `reveal.ts` and its tests (replaced). Browser check: page box jump to 3, next to 4, zoom tooltip; manual expand and collapse; reading to the end of Chapter 3 opened the card, which collapsed after ~10 s with the dot; ✏️ opened the Chapter 3 note; ❓ opened the test page; the Ask AI icon showed its tooltip. **Not tested:** the real book you used, touch, narrow windows (the pill and the card can touch).
- 2026-11-14: **Slice 6 built** (Test your understanding tab). A small tab sits on the bottom edge of the book. It opens to "Test your understanding" when the reader starts scrolling and closes 3 s later; it reopens only after a pause in scrolling, and stays closed while text is selected. Only the reader's own scrolling (wheel, touch, keys, dragging the scrollbar) opens it, not jumps or the page restoring itself. Hover or keyboard focus keeps it open. It links to `/read/[id]/test`, a "Coming soon" page with a way back. Rules in `reveal.ts` with tests. Browser check: closed at load; opened on a wheel scroll and showed the label; closed again after 3 s; didn't open while text was selected; opened again after clearing the selection; a click went to the placeholder page. **Not tested:** touch, a real mouse wheel at speed, a screen reader.
- 2026-11-14: **Slice 5 built** (chat). Tested with a **free Gemini model** (`gemini-flash-lite-latest`) through a new `LLM_PROVIDER` switch in `llm.ts` (ADR 007, approved by Hemanth for testing only); **DeepSeek has not been tested yet**. New: `chatMessages` table, `chat.ts` (ask, validateNote, history, quota), `chatRules.ts`, Chat tab, **Ask AI** in the selection menu (puts the quoted text in the chat box for the reader to send), **Validate** in the note toolbar (checks the note against the book, shows ✓/✗ with corrections and page chips; counts toward the 5/day; not saved). Behaviour: search the whole book, favor the current chapter, keep ~6 passages, drop any citation that doesn't point at a given passage. A failed question isn't counted. Browser check on a 9-page test book with distinct facts: correct cited answer (66 days, page 3 chip jumps there); chapter 2 and chapter 3 summaries each used only their own chapter; Ask AI filled the box; Validate marked one claim right and two wrong with corrections; the 5th question worked and the box then showed "Out of questions for today". Bug fixed in testing: summary citations used page numbers, so they were dropped. Summary passages are now numbered by page. Test changed on purpose: removing a bad marker no longer leaves a space before punctuation. **Not tested:** DeepSeek answers and cost, a real book, questions the search can't match (keyword search only), prompts trying to override the rules, 25 MB books.
- 2026-11-14: **Slice 4b built** (reflections). `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` added (approved). New `reflections` table (with the small `dismissed` addition, as proposed). The note is rich text (bold, italic, bullets, numbered lists), autosaves ~0.8 s after typing stops, one per chapter, and an empty note deletes the reflection. It fills the right panel; **Expand** opens a larger window over the book and **Minimize** (button, Esc or clicking outside) returns it; the text carries across. The end-of-chapter card appears only when reading naturally past a chapter's last page (a jump never triggers it), **Not now** is remembered, and a card left alone tucks away after 15 s and leaves a dot on the Reflect button. No contents means no chapters, so the panel says reflections aren't available. **Validate is not built yet** (needs chat and AI, slice 5). Checked in the browser on the 300-page book: write with bold, italic and bullets; autosave shows Saved; expand and minimize keep the text; list shows the reflection; reading through the end of Chapter 1 showed the card; Not now stored a dismissed row. **Not tested:** the 15-second tuck and dot, numbered lists by hand, a very long note, two tabs editing the same note.
- 2026-11-14: **Slice 4a built.** Checked in the browser: overlay opens without moving the book; right panel opens at 360 px (1/3 of this 1024 px window is below the 360 minimum); drag and arrow keys resize it and the book re-fits; width survives reload; Esc closes the left overlay first, then the right panel; clicking the book or choosing a contents entry closes the overlay; Chat is hidden for a scanned PDF. Chat and Reflections tabs hold placeholders until 4b and slice 5. **Not tested:** a wide window (the 1/3 default), touch.
- 2026-11-14: **Slice 3 built** (highlights + comments). Deviations from PRODUCT.md: the selection menu has **Highlight** and **+ Comment** only; **Ask AI** is coded into the menu but hidden until chat exists (slice 5), since the right panel isn't built. Selections can cross a page break (stored as `segments`, one per page; the panel jumps to the first page). Added the `highlights` table, `highlights.ts`, `highlightRules.ts`, `chapterOf`. Left rail now has two buttons (Contents, Highlights with a count badge) instead of tabs inside the panel. Checked in the browser on the 300-page book: highlight, cross-page highlight, comment (Enter saves), group under the chapter, jump + flash, zoom keeps marks aligned, reload keeps them, delete, scanned PDF hides Highlights. **Not tested:** delete of a highlight with a comment (it asks to confirm), real mouse drag, a real book, two-column pages, text with unusual fonts.
- 2026-11-14: **Slice 2 built** (reader + Contents). Added `documents.fileUrl`, `documents.saveProgress`, `chapters.ts` (current contents entry for a page). `pdfjs-dist` 6.5.438 installed. Checked in the browser with a generated 300-page book: TOC jump lands exactly on the page in ~170 ms, zoom 100→150% keeps the page, last page restores after reload, text is selectable, a scan is readable with a note, and an empty TOC says "No contents found". Fixed while testing: page-visibility reports can arrive in batches, so the latest one is used. **Not yet tested with a real book, with mixed page sizes, or on a very slow connection.** Zoom snaps to the top of the current page.
