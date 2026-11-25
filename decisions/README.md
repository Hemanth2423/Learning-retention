# Decisions

One file per architectural decision: `NNN-short-name.md`. Read one only when you touch what it covers.

**Add one when** a choice is hard to reverse, or a future agent might "fix" it without knowing why.

## Template (keep it under half a page)

```markdown
# NNN. Title
**Date:** YYYY-MM-DD · **Status:** accepted | replaced by NNN

**Context:** the problem, in 1–2 lines.
**Decision:** what we chose.
**Why:** the reason, and what we gave up.
```

## Index

| # | Decision |
|---|---|
| [001](001-convex-backend.md) | Convex for backend, database, storage and auth |
| [002](002-read-once-concept-model.md) | Read the PDF once; build lessons on demand |
| [003](003-question-rules-in-code.md) | Question rules live in code, not prompts |
| [004](004-source-agnostic-documents.md) | Documents made of chunks + locators; one adapter per format |
| [005](005-chat-retrieval-checked-citations.md) | Chat = retrieval + checked citations; AI only on request (replaces 002) |
| [006](006-pdfjs-and-highlight-anchoring.md) | pdf.js renders; highlights anchor to page + boxes |
| [007](007-gemini-for-testing.md) | Free Gemini for testing via `LLM_PROVIDER`; DeepSeek stays default |
| [008](008-parts-when-no-contents.md) | Books without contents get 20-page parts |
| [009](009-simple-xp-started-fresh.md) | Simple XP, levels and streaks, started fresh |
| [010](010-tests-generated-once-per-chapter.md) | A chapter's test is generated once and reused |
| [012](012-articles-and-videos-by-link.md) | Articles (Firecrawl) and YouTube (oEmbed) by link; a `text` locator where page = block |
| [011](011-groq-default-provider.md) | Groq (`openai/gpt-oss-120b`) is the default AI service; DeepSeek and Gemini via `LLM_PROVIDER` |
| [013](013-covers-and-add-queue.md) | Covers drawn in the browser (text pages keep the colour cover); one Add sheet + queue |
| [014](014-notebook.md) | One Notebook: many notes per book, saved questions, text highlights; old notes moved |
| [015](015-epub-word-powerpoint-in-the-browser.md) | EPUB, Word and PowerPoint read in the browser into text blocks; EPUB is a book |
| [016](016-library-folders.md) | Library folders: one folder per item; deleting a folder keeps its items |
| [017](017-nested-folders-playlists-reader-copy.md) | Nested folders, playlists as folders (YouTube Data API), cleaned reader copy + Original view |
| [018](018-youtube-usage-budget.md) | Hard YouTube budget: 1,000 units/day for the app (10%), 50 per reader |
