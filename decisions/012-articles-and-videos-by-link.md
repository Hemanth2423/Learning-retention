# 012. Articles and YouTube videos by link; a "text" locator
**Date:** 2026-11-19 · **Status:** accepted (Feature 3 slice 1; team-assignment API feature)

**Context:** Readers learn from articles and talks too. The app's model was PDF-only: `documents.fileId` required, locators only `{kind: "pdf", page}`.
**Decision:**
- `documents.sourceType` is `pdf | article | video`; `fileId` is optional (PDFs only). New optional fields `sourceUrl` (canonical link, indexed with `userId` to refuse duplicates), `siteName`, `imageUrl`, `videoId`.
- Articles are read once on the server with **Firecrawl** (Markdown), cleaned (`linkRules.cleanArticleMarkdown`), split into blocks of ≤1,500 characters and saved as `chunks` with a new locator `{kind: "text", page: n}`, where `page` is the block number. Everything that works per page (Ask, summaries, citations, chapter ranges, notes) works unchanged. The article is one "chapter" (`sections: [{key: "article"}]`).
- Videos use **YouTube oEmbed** (title, channel; no key) and the `i.ytimg.com` thumbnail; they play in YouTube's privacy-enhanced embed. No chunks, no Ask.
- A page Firecrawl can't read (paywall, login) is saved **as a link** (`hasText: false`) with "Open original"; a 404 page or an unavailable video saves nothing.
- Articles and videos earn no XP and have no path or tests (Feature 3 spec).
**Why:** Smallest change that reuses the whole reading stack; one paid call per article, never repeated. Cost: "page" means "block" for text sources (documented in `locators.ts`), and citation chips say "§3" instead of "p.3" for articles.
