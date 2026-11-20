# Ingrain: Architecture

Read this before changing any component listed here. It describes the **target design for Feature 1 (Reading experience)**. Status: **approved, not built.** Anything marked ⚠ needs Hemanth's approval first (see AGENTS.md).

## System map

```
Browser (Next.js 16, React 19, Tailwind 4)  ── hosted on Vercel
   │  PDF viewer (pdf.js)  ·  Convex React client (live queries, mutations)
   ▼
Convex (backend + database + file storage + auth)
   │  scheduled actions
   └──► DeepSeek flash (chat answers, chapter summaries, note checks) via llm.ts
        (set LLM_PROVIDER=gemini on the dev deployment to use a free Gemini model for testing, ADR 007)
```

No other external service. Firecrawl and the v4-pro concept model are not part of Feature 1.

## Flows

1. **Upload:** browser checks type and size (≤25 MB) → uploads to Convex storage → `documents.create` (status `processing`) schedules `ingest`.
2. **Ingest (no AI):** a source adapter reads the file and returns `{title, sections, chunks, hasText}`. For PDF: text per page, the outline (TOC) resolved to page numbers, and `hasText=false` if pages have almost no text (scan). Saved, status → `ready`; the browser then opens the reader.
3. **Read:** the browser loads the PDF from storage and renders it with pdf.js. Only visible pages (± a few) are mounted, so a 500-page book stays fast. The last page is saved on a short delay.
4. **Highlight / reflect:** written straight to Convex, checked by `requireUser`.
5. **Ask (AI, on request only):** `chat.ask` first checks the daily limit (5 questions in the last 24 hours). It then searches the document's chunks, **boosts pages in the chapter the reader is in**, sends the top passages to flash, and saves the answer with its citations checked in code.

## Core model (the source-agnostic part)

| Concept | Meaning | PDF today | Later |
|---|---|---|---|
| **Document** | One thing the user is learning from | uploaded PDF | link, YouTube, EPUB |
| **Chunk** | A readable piece of text with a **locator** | one page | a transcript segment, an article section |
| **Section** | A navigable entry (TOC) pointing at a locator | PDF outline entry | video chapters, headings |
| **Locator** | Where something is, as a tagged union | `{kind:"pdf", page}` | `{kind:"time", seconds}` |

Highlights, reflections and citations all store **locators**, never PDF-only fields on their own. Adding a format means a new adapter and a new locator kind; the panels, chat and search don't change.

## Data (new tables in `convex/schema.ts`, approved; ADR 004)

| Table | One row per | Key fields |
|---|---|---|
| `documents` | upload or link | `userId`, `title`, `sourceType` (pdf, article, video), `fileId` (PDFs), `sourceUrl` + `siteName` + `imageUrl` + `videoId` (links; index `by_user_source` refuses duplicates), `status`, `hasText`, `pageCount`, `sections[]`, `lastLocator` · locators are `{kind: "pdf" \| "text", page}` (ADR 012) |
| `chunks` | page of text | `documentId`, `index`, `text`, `locator` · **search index on `text`**, filtered by `documentId` |
| `highlights` | highlight | `userId`, `documentId`, `locator` (first page), `text`, `segments` (per page: boxes as fractions of the page), `comment?` |
| `reflections` | chapter reflection | `userId`, `documentId`, `sectionKey` (the chapter), `content` (Tiptap JSON), `plainText` (for AI), `dismissed?` |
| `chatMessages` | message | `userId`, `documentId`, `role`, `kind` (chat, summary, validate, quiz), `text`, `citations[]` (`{n, page}`) · the `by_user` index also powers the daily limit. `validate` and `quiz` rows count toward the limit but aren't shown |

- **Chapter is computed, not stored.** `chapters.ts` maps a page to its chapter from `sections`, so highlights group correctly even if the TOC rule changes.
- **Ownership:** every row carries `userId`; every public function starts with `requireUser`, and documents load through `getOwnDocument`.

## Code layout

| Where | What |
|---|---|
| `convex/documents.ts`, `ingest.ts` | Create, list-latest, status; the ingest action |
| `convex/sources/pdf.ts` | The PDF adapter. One file per future format |
| `convex/chapters.ts` | **Pure** page→chapter rules, chapter page ranges and "finished a chapter" detection (tested) |
| `convex/highlights.ts`, `highlightRules.ts`, `reflections.ts`, `reflectionRules.ts` | CRUD, owner only; pure rules for checking input, joining boxes and validating notes |
| `convex/chat.ts`, `chatRules.ts` | Ask and validate actions, history, daily limit; pure rules for the limit, search words, chapter boost, citation and answer checks |
| `convex/xp.ts`, `xpRules.ts` | XP, level and streak: `awardXp` (called only from saveProgress, notes save and test answers), `stats`, `setTimeZone`; pure rules for award keys, levels, the reader's day and streaks |
| `convex/links.ts`, `linkRules.ts` | Add an article (Firecrawl, server only) or YouTube video (oEmbed) by link: duplicate check, fetch once, save text blocks; pure rules for link parsing, URL cleaning, Markdown cleaning and block splitting |
| `convex/quizzes.ts`, `quizRules.ts` | Test yourself: make a chapter's test once (`prepare`), start a round (full or missed only), grade each answer on the server, best scores for the path; pure rules for a usable question, shuffling and scores |
| `convex/llm.ts`, `auth.ts`, `helpers.ts` | Every LLM call (DeepSeek, or Gemini when `LLM_PROVIDER=gemini`), sign-in, access |
| `app/` + `components/reader/` | Upload page, `/read/[id]`, `/read/[id]/test`; viewer, left overlay (Contents, Highlights), resizable right panel (Chat, Reflections), test tab |

**Legacy** (`courses`, `topics`, `lessons`, `reviews`, gamification, etc.) stays untouched until a feature replaces it. Nothing is deleted without asking.

## Critical decisions (each has an ADR)

1. **Source-agnostic documents with locators** (ADR 004). Why: your "add YouTube and articles later" need. Cost: slightly more abstract than a PDF-only model.
2. **Chat is retrieval over chunks, not the whole book** (ADR 005). Convex's built-in text search returns the top ~30 pages; code re-ranks them to **favor the reader's current chapter** and keeps the best ~6; flash answers from them. Why: a 25 MB book can be 200k+ tokens, so sending it per question is slow and expensive; no new vendor. Cost: keyword search can miss paraphrased questions. Upgrade path: embeddings later (⚠ new API).
3. **Citations get a simple check in code** (ADR 005): the model may only cite chunks it was given. Why: a wrong page link destroys trust. Answer quality is deliberately basic for now and gets tuned later.
4. **pdf.js renders the PDF in the browser** (ADR 006), dependency `pdfjs-dist` (approved). Why: the only way to get selectable text and exact positions. Highlights store the page, the text and page-relative boxes, so they survive zoom and reload.
5. **AI never runs on upload, and chat is capped at 5 questions per user per day** (ADR 005). Ingest is plain code, so uploads cost nothing. The cap is enforced on the server, not the browser.

## Contracts (break these and something breaks silently)

- **Every public query and mutation calls `requireUser`.** The user comes from the session, never the browser. Tested in `dataIsolation.test.ts`.
- **The model never sees the whole book.** It sees retrieved passages or the current chapter, always with locators. *(Replaces the old "only the concept model sees the full PDF".)*
- **Cited answers only cite what was retrieved**, checked in code and tested.
- **Every LLM call goes through `llm.ts`**, which logs `[tokens]`. AI runs only in actions, only on a user request.
- **Never trust the browser's file check.** Type and size are re-checked on the server after upload.

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

See [tasks/feature-3-sources-and-notebook.md](tasks/feature-3-sources-and-notebook.md). ⚠ = schema change.

| Change | How | Why this way |
|---|---|---|
| ⚠ **Covers** | `documents.coverId` + `coverChecked`; page 1 drawn in the browser, checked by `documents.setCover` (ADR 013) | Free, no server rendering; text-page PDFs keep the colour cover |
| **Add sheet + queue** | `components/upload/`: Files and Links tabs, one item at a time, each with its state and reason | Bulk add without hitting Firecrawl or storage all at once |
| ⚠ **Notebook** | `notes` (many per book, optional chapter, video `seconds`), `savedQuestions`, `highlights.range` for text; `convex/notebook.ts` + `notebookRules.ts`; old `reflections` moved by `notebook.migrateReflections` (ADR 014) | One list for review and export; nothing deleted |
| **Export** | `convex/exportRules.ts`: the one builder (book → chapters in order → notes, highlights + comments, saved questions) → Markdown, print HTML; built in the browser, nothing sent anywhere. Notion / Google Docs reuse it | One tested builder for every destination (TEAM-PLAN.md) |

