# Ingrain: Architecture

Read this before changing any component listed here. It covers the core system. Later feature details are in the archive linked at the end.

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
| `convex/concepts.ts`, `conceptRules.ts`, `conceptPrompts.ts` | Concept check (ADR 019): generation pipeline, server grading, sessions, computed status, schedule and question checks. Tables: `conceptChecks`, `conceptQuestions`, `conceptSessions`, `conceptAnswers` |
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

## Added since Feature 1
- **Library:** progress, tests, XP, covers, folders. **Sources:** EPUB, Word, PowerPoint, articles, video. **Notebook:** notes, saved questions, export.
- Details and reasons: [docs/archive/architecture-history.md](docs/archive/architecture-history.md) and ADRs 008–018.
- **Concept check:** built, [ADR 019](decisions/019-concept-check-ladder.md).

## Notebook exports

| Table | Purpose | Index |
|---|---|---|
| `integrations` | Per-reader provider connection with server-only tokens and a workspace name | `by_user_provider` |
| `oauthStates` | Single-use OAuth state with the requesting reader and return path, expired after 10 minutes | `by_state` |
| `exportTargets` | Selected parent, remote page ID and link, and last successful send for each book and provider | `by_document_provider` |

Convex actions use the shared notebook builder to export saved chapter notes and highlights. Retrying an export uses the saved Notion page so its link stays stable.
