# Architecture history (Features 2–4)

Read only when changing one of these areas.

## Feature 2 changes (approved 2026-11-17, being built)

See [tasks/feature-2-library-and-path.md](tasks/feature-2-library-and-path.md). ⚠ = schema change.

| Change | How | Why this way |
|---|---|---|
| ⚠ **% read per chapter** | `documents.pagesSeen`: one character per page, "1" once seen (344 pages = 344 bytes). A page counts once it's on screen for about 2 s during normal reading. The browser sends only new pages, folded into the existing last-page save every 1.5 s. Chapter % = pages seen ÷ chapter pages, worked out from `sections` (pure rule, tested) | No new table, no extra request, no slowdown. Jumps don't count as reading. Simpler fallback: store only the furthest page (one number), but a jump to the end would mark the whole book read |
| ⚠ **Tests** | `quizzes`: one row per chapter (5 questions; answer keys never sent to the browser). `quizAttempts`: score, answers, best score. Generated on the first "Test yourself" from that chapter's pages via `llm.ts`, then reused | One AI call per chapter. Retakes and "review missed" are free and instant. Rules (4 options, 1 right, shuffled, server grading) live in code |
| ⚠ **XP, level, streak** | `learnerStats`: one row per user (xp, streak, last active day). XP is added by server mutations only (read 10, note 20, right answer 10); each award recorded once per chapter so it can't be farmed. Level = xp ÷ 100 + 1 | Started fresh, not the legacy `profiles`/`achievements` (ADR 009). Simple and testable |
| **Images in notes** | `noteImages` (userId, documentId, storageId); images ≤5 MB uploaded to Convex storage; the note holds the link | Deleted with the book by the same background purge |
| **Library** | `documents.list` (owner's books, newest-read first), `documents.rename`, `documents.remove` | Remove deletes the file, chunks, highlights, notes, chat, tests and attempts for that book |
| **Parts for books without contents** | `chapterRanges` falls back to 20-page parts with keys `part-1`, `part-2`… | One code path for the chapter path, % read, notes and tests (ADR 008) |

## Feature 3 changes (approved 2026-11-19, being built)

See [tasks/feature-3-sources-and-notebook.md](../../tasks/feature-3-sources-and-notebook.md). ⚠ = schema change.

| Change | How | Why this way |
|---|---|---|
| ⚠ **Covers** | `documents.coverId` + `coverChecked`; page 1 drawn in the browser, checked by `documents.setCover` (ADR 013) | Free, no server rendering; text-page PDFs keep the colour cover |
| **Add sheet + queue** | `components/upload/`: Files and Links tabs, one item at a time, each with its state and reason | Bulk add without hitting Firecrawl or storage all at once |
| ⚠ **Notebook** | `notes` (many per book, optional chapter, video `seconds`), `savedQuestions`, `highlights.range` for text; `convex/notebook.ts` + `notebookRules.ts`; old `reflections` moved by `notebook.migrateReflections` (ADR 014) | One list for review and export; nothing deleted |
| **Export** | `convex/exportRules.ts`: the one builder (book → chapters in order → notes, highlights + comments, saved questions) → Markdown, print HTML; built in the browser, nothing sent anywhere. Notion / Google Docs reuse it | One tested builder for every destination (TEAM-PLAN.md) |
| ⚠ **EPUB, Word, PowerPoint** | `sourceType` adds `epub`/`word`/`powerpoint`; read in the browser (`components/upload/readFile.ts`, deps `fflate`, `mammoth`) into Markdown blocks; `convex/textSources.ts` + `textSourceRules.ts` re-check everything; one `TextReader` for all text sources (ADR 015) | No server parsing or AI; EPUB gets the full book experience |

## Feature 4: folders (approved 2026-11-21)

| Change | How | Why this way |
|---|---|---|
| ⚠ **Folders** | `folders` table + optional `documents.folderId` (index `by_folder`); `convex/folders.ts` (list, create, rename, remove, moveItems) + `folderRules.ts`; add paths take an optional `folderId`; rail in `components/library/FolderRail.tsx` (ADR 016) | Any format in any folder; deleting a folder never deletes items |
| ⚠ **Nesting + playlists** | `folders.parentId` (4 levels), `folders.playlistId`; `links.addPlaylist` calls the **YouTube Data API** (`YOUTUBE_API_KEY`, server only) (ADR 017) | Playlists reuse folders; nothing new to learn |
| **Article view** | `linkRules.cleanArticleBlocks` runs when reading (stored text unchanged); `links.canEmbed` decides if the Original tab can frame the page | Cleans old articles at no cost; safe header check |
| **PDF selection** | `components/reader/textSelection.ts`: pdf.js end-of-content technique; pages and viewer memoised | Exact selection; long books stay smooth |
| ⚠ **YouTube budget** | `apiUsage` table; `links.reserveYoutube` / `refundYoutube` cap the app at 1,000 units/day (10% of quota) and a reader at 50 (ADR 018) | The limit holds regardless of traffic |

