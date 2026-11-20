# 015. EPUB, Word and PowerPoint read in the browser, stored as text blocks
**Date:** 2026-11-20 · **Status:** accepted (Feature 3 slice 6)

**Context:** Readers learn from EPUBs, Word documents and slide decks, not only PDFs. Parsing them on the server would need a DOM library and more server time.
**Decision:**
- `documents.sourceType` gains `epub`, `word`, `powerpoint`. The browser reads the file (`fflate` for zips, `mammoth` for Word, the slide XML for PowerPoint), turns it into plain Markdown text blocks (no HTML is kept, so scripts in an EPUB can't run) and a contents list, then sends them in batches (`textSources.begin → addBlocks → finish`, or `fail` with the reason). The server re-checks the file size and type, block order and size, and that every contents entry points inside the text.
- Blocks use the `text` locator (ADR 012), so Ask, citations, highlights, the Notebook and export work unchanged. A chapter always starts a new block, so Contents jump exactly.
- **EPUB is a book:** chapter path with Part dividers, Contents, % read by scrolling, end-of-chapter card, tests and XP, and its own cover. **Word / PowerPoint** get reading, Contents, Notebook and Ask, but no path, tests or XP. PowerPoint keeps slide text only.
- `dompurify` was approved but isn't needed: nothing renders raw HTML.
**Why:** No server parsing, no AI, no per-use cost; one text reader for every non-PDF source. Cost: a very large EPUB is read in the browser's memory (25 MB cap), and PowerPoint loses pictures (the Add sheet says so and suggests saving as PDF).
