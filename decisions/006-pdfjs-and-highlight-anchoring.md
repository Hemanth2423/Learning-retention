# 006. pdf.js renders the PDF; highlights anchor to page + boxes
**Date:** 2026-11-14 · **Status:** accepted (`pdfjs-dist` approved 2026-11-14)

**Context:** Readers need selectable text, exact jump-to-spot and highlights that survive zoom and reload.
**Decision:** Render with pdf.js in the browser, mounting only visible pages. A highlight stores `{locator(first page), text, segments}`. `segments` has one entry per page it covers, with boxes as fractions of the page size, so a selection can cross a page break. Chapter grouping is computed from the page at read time, never stored.
**Why:** Fractions keep boxes correct at any zoom; storing the text allows re-anchoring and search. Cost: one new client dependency (the server already uses `unpdf`).
