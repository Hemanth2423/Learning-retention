# 013. Covers made in the browser; one Add sheet with a queue
**Date:** 2026-11-19 · **Status:** accepted (Feature 3 slice 3)

**Context:** Library tiles were plain colour blocks. Adding was one PDF or one link at a time, and each opened straight away.
**Decision:**
- `documents.coverId` (optional storage id) holds a small JPEG cover. For a PDF the browser draws page 1 with pdf.js (already a dependency) at upload, or the first time the library opens for older books (one at a time, page 1 only, no prefetch). `documents.setCover` re-checks type (JPEG/PNG/WebP/GIF, never SVG) and size (≤1 MB) on the server and deletes anything else.
- A first page that is mostly white (under 20% ink: a text or title page) is **not** used: `documents.coverChecked` is set and the plain colour cover with the title stays. Real covers are mostly picture.
- Articles and videos keep their preview image / YouTube thumbnail (`imageUrl`); with none, a colour tile with the site's first letter.
- One **Add sheet** (Files | Links, up to 20 files, links one per line, each checked with a reason) feeds a **corner queue** that adds items one at a time and shows each one's state. Nothing opens by itself any more, so new links stay "New" (no `lastReadAt` on add).
**Why:** Covers cost nothing (no AI, no server rendering) and make the library scannable. Cost: the first library visit downloads page 1 of each older PDF once.
