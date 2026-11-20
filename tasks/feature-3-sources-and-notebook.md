# Task: Feature 3, More sources, one Notebook, export
**Status:** approved 2026-11-19, re-ordered for the team assignment (see Plan update) · **Branch:** one branch per slice from `main` · **PR:** per slice, each needs a teammate's approval

## Why
- **User problem:** readers learn from more than PDFs (EPUBs, articles, talks, docs), and what they capture is scattered across notes and highlights, stuck inside Ingrain.
- **Outcome it serves:** reflection that is easy to do and **keep** (PRODUCT.md): everything in one Notebook, taken wherever the reader keeps their knowledge.

## Design
Agreed in the local prototype `005-clickable-app.html` (`.context/compound-engineering/ce-prototype/2026-11-16-reader-ux/02-sources-notebook-export/screens/`, gitignored). Decisions and the feasibility check are in that run's `decisions.md` (rounds 3–5). Flow stays **Library → read/watch → Library**.

## Acceptance criteria

### A. Polish (match the prototype)
- [ ] One type scale (label 12 · meta 13 · UI 15 · reading 18, plus headings), three button kinds (retro, chunky, quiet) plus icon buttons, one segmented-control style (soft terracotta, no white pill), cream inputs with an ink border on focus, 16 px drawer padding, emoji icons, chat answers in a card, empty states that say what to do next.

### B. Library
- [ ] **All · Books · Articles · Videos** filter and search.
- [ ] Every tile sits in the same padded, rounded frame; the title shows once, under it. **Covers:** an EPUB's own cover, a PDF's first page, a YouTube thumbnail, an article's preview image; plain colour + title (or site letter) when there is none.
- [ ] **Add to your library:** Files tab (PDF, EPUB, Word, PowerPoint; up to 20 at once, 25 MB each) and Links tab (articles and YouTube, one per line, each with a preview). A corner queue shows each item's status; a failed link says why (e.g. paywalled → saved as a link).

### C. Reading new sources
- [ ] **EPUB = a book:** chapter path (Parts as dividers), Contents, end-of-chapter card, tests, XP. % read = how far you've scrolled in each chapter; "↗" links go to the spot, not a page number.
- [ ] **Articles** are fetched once on the server with **Firecrawl** (the team-assignment API) and open in reader mode with **Open original ↗**. **Word / PowerPoint** open in the same reader (PowerPoint: slide text only, with a hint to save as PDF to keep slides). These get reading, Notebook and Ask, but no path, tests or XP.
- [ ] **YouTube** plays embedded, with a quick-note bar; each note keeps its time and clicking it jumps the video there. No Ask, tests or XP for videos.

### D. Notebook (in Study tools, not a page)
- [ ] Study tools tabs: **Ask · Notebook · More**. Highlights live in the Notebook.
- [ ] Notebook shows notes, highlights (with comments) and saved questions; switch **This chapter | Whole book**; filters All · Notes · Highlights · Saved; search. Whole book = General notes, then Part → Chapter in book order; groups with nothing matching are hidden; General notes only under All and Notes.
- [ ] **✏️ Write a note** (primary) and **⤓ Export** (second) are pinned at the bottom. Write opens a Gmail-style compose window in the bottom half of the drawer: **In: General notes / a chapter**, toolbar, minimise, bigger window, close (asks before discarding a draft). **Edit** opens the same window; notes in the list show 4 lines with "Show more".
- [ ] A reader can write any number of notes, about a chapter or not, in any order; nothing requires reading in order.
- [ ] Selecting text → **Highlight / Comment / Ask**; a highlight appears in the Notebook at once; "↗" scrolls the book to it.
- [ ] **⇤ Widen** (icon, left of the title) makes the drawer ~60% wide over the book and adds a Jump-to outline.
- [ ] After a wrong test answer, **📓 Save to notes** adds the question, your answer and the right one under that chapter. Results never go in by themselves.

### E. Export and send
- [ ] Choose what to include (notes, highlights and comments, saved questions). **Download Markdown**, **PDF** (print), **Copy all**.
- [ ] **Notion** (@abbystern) and **Google Docs** (@EEBarr14) are built by teammates for the team assignment (TEAM-PLAN.md), on the path's side card first. Feature 3 later moves their Send buttons into the Export sheet. Obsidian: "Soon" (Markdown covers it for now).
- [ ] Export is also on the path's side card.

## Slices (one at a time; each ends with a browser check and a PR a teammate approves)
| # | Slice | Done when |
|---|---|---|
| 1 | **Articles + YouTube by link** (C, part of B) · *team-assignment feature, live by Dec 2* | Paste an article or YouTube link; it's saved (Firecrawl / oEmbed on the server), shows in the library, opens (reader mode / embedded player) with a chapter-style note and Ask (articles). Duplicate links are refused. Test in the same PR |
| 2 | **Polish pass** (A) | The audit items are fixed across Home, path, reader, drawer and test |
| 3 | **Library tiles and covers** (B) | Padded rounded tiles, PDF first-page covers, article/YouTube images, All · Books · Articles · Videos |
| 4 | **Export downloads** (E) | Markdown, PDF and copy, reusing the teammates' `convex/exportRules.ts` |
| 5 | **Notebook** (D) | After the Notion/Docs PRs merge: Notebook tab replaces Highlights; many notes per book with an optional chapter; compose window; saved questions; text highlights in the new reader; `exportRules.ts` and their tests updated in the same PR |
| 6 | **EPUB, Word, PowerPoint + bulk add** (B, C) | Each uploads and opens in the text reader; EPUB gets the path, tests and XP; the queue reports failures |

**Plan update (2026-11-19):** Re-ordered so the graded feature ships first; Notion/Docs moved to teammates; Firecrawl replaces the Readability library for articles; Notebook waits until the export PRs merge so we don't break their builder (it reads today's one-note-per-chapter `reflections` and `highlights`).

## Constraints
- **Cost:** no AI for converting or covers. AI only for Ask, tests and Check (existing daily limit). Free YouTube endpoints only, so **no video length** (needs a Google API key). **Firecrawl** costs 1 credit per article added (key already set on dev and prod); stored once, never re-fetched.
- **Deadline:** slice 1 is live on the production URL before **Dec 2**, merged through a reviewed PR with its test passing in CI.
- **Needs approval when the slice starts:** schema changes (slice 2: notes many-per-book with an optional place, saved questions; slice 1: source kind, URL, site, image, video id and a text locator; slice 6: cover) and new libraries (slice 1: a Markdown renderer such as `react-markdown`; slice 6: `fflate`, `mammoth`, `dompurify`). Notion/Docs libraries are the teammates' call.
- **Security:** EPUB, Word and article HTML is cleaned (no scripts) before it is shown.
- **Out of scope:** Ask on videos, images (jpeg), two-way sync, Obsidian sync, slide images, mobile. Slice 1 leaves out highlights on articles (they come with the Notebook in slice 5).

## Open questions
1. **Existing notes:** today each chapter has one note. Move each into the new Notebook as a note on that chapter (recommended), or start fresh?
2. **Articles behind a login** (e.g. Medium): accept "saved as a link" for now?

## Verification
- [ ] Tests: **slice 1 (graded):** "Given I already added an article link, when I add the same link again (with or without tracking parameters like `?utm_source=`), then I'm told it's already in my library and no second item is saved" (TEAM-PLAN.md); link detection (article vs YouTube id forms). Later slices: note placement and filtering, saved questions, export content (Markdown output), EPUB/Word/PowerPoint text extraction, link detection (article vs YouTube), cleaning of unsafe HTML, owner-only access for every new function.
- [ ] Browser: each slice end to end with real files (an EPUB with Parts, a Word file, a PowerPoint, two article links, a YouTube link), and the exported Markdown opened in Obsidian.

## Status log
- 2026-11-19: **Slice 5 built** (ahead of slice 4, so export reads the new shape; Hemanth approved building it before the teammates' PRs): Study tools = Ask · Notebook · More; notes many-per-book with an optional chapter (General notes), compose window (In: picker, minimise, bigger, close asks before discarding), This chapter | Whole book, All · Notes · Highlights · Saved, search, ⇤ Widen with Jump-to outline, Part → Chapter grouping, 4-line notes with Show more; text highlights + Highlight/Comment/Ask in articles; timed quick notes for videos (click a time to jump); 📓 Save to notes after a wrong answer; path Notes markers and end-of-chapter "Write a note" open the compose window. Old chapter notes moved (7 on dev). ADR 014. **Deviations:** compose saves with an explicit Save (no autosave), so "asks before discarding" is meaningful; the Notebook's Write button is the full-width primary action, Export joins the bar in slice 4.
- 2026-11-19: **Slice 3 built**: padded rounded tiles (title once, under the tile), PDF first-page covers drawn in the browser (backfilled for older books), YouTube thumbnails and article images (colour + site letter when none), All · Books · Articles · Videos chips with counts, path side-card cover. **Add sheet** (Files: several PDFs, Links: one per line with preview and per-line reasons) feeds a **corner queue** with each item's state and why it failed. ADR 013. Browser-checked with a PDF with a picture cover (cover drawn), a duplicate article (refused, "Open it"), a new video and bad/duplicate lines. **Deviations:** a mostly white first page (text/title page) keeps the colour cover instead (it looked blank); link previews show kind, site and YouTube thumbnail, not the title (getting a title costs a Firecrawl credit); adding no longer opens the item.
- 2026-11-19: **Slice 2 built** on `feat/feature-3-rest` (stacked on #82's branch; rebase onto `main` once #82 merges). One type scale as tokens (`text-label/meta/ui/read`, `text-h3/h2/h1/display`); buttons are retro, chunky (+ `chunky sm`), quiet and `icon-btn`; one `.seg` control (Study tools tabs, library sort); `.input` with an ink border on focus (Ask box, link field, note editor); 16 px drawer padding, cream drawer; emoji for drawer tabs and the selection menu; chat answers in a card; `.empty-note` empty states that say what to do next; article wording ("Summarize this article", "Ask about this article", "Remove this article/video?"). Browser-checked: library, PDF reader + drawer (all tabs), article Ask, path, video. **Deviations:** inputs use the card colour (as in the prototype and audit), not cream; `btn-primary/ghost/danger` stay defined for legacy pages only (`ConfirmDialog` now uses quiet + chunky); book covers and the landing page left as they are (covers in slice 3); the selection menu stays icon-only with tooltips (round 1 decision), now emoji.
- 2026-11-19: **Slice 1 built** (PR #82, issue #81): articles via Firecrawl and YouTube via oEmbed, added by link under the upload card; duplicates refused (graded test); reader mode with Open original, Ask (§N citations) and a note; videos embedded with a note; paywall saved as a link; no XP/path/tests for links. Schema per ADR 012; `react-markdown` added. **Deviations:** link field under the upload card (Add sheet + bulk queue in slice 3); article highlights and timed video notes wait for slice 5. **Decision:** the remaining slices (2–6) go on one branch and one PR.
- 2026-11-19: Approved and re-ordered for the CodeMates team assignment (demo Dec 2): slice 1 = articles (Firecrawl) + YouTube; Notion/Docs moved to @abbystern and @EEBarr14; Notebook after their PRs merge.
- 2026-11-19: Spec written from prototype 005 and Hemanth's rounds 3–5.
