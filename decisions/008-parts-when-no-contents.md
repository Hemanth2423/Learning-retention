# 008. Books without contents get 20-page parts
**Date:** 2026-11-17 · **Status:** accepted by Hemanth (not built)

**Context:** The chapter path, % read, notes and tests are all per chapter, but some PDFs have no table of contents.
**Decision:** When a PDF has no contents, `chapterRanges` splits it into parts of 20 pages ("Part 1 · pages 1–20"). Everything downstream treats a part like a chapter.
**Why:** One code path instead of a second "no chapters" mode. Cost: parts may cut through the middle of an idea.
