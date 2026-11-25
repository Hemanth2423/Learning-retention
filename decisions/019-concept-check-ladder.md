# 019. Concept check: evidence per idea and practice mode
**Date:** 2026-11-23 · **Status:** accepted (Hemanth approved the build on 2026-11-23, before the human quality gate)

**Context:** Chapter tests give one score, so a reader can't see which ideas they know or how deeply.
**Decision:** Track Remember, Understand, Apply and Analyze per idea, with no locks. Keep every answer as an event and compute status in a pure rule. Separate practice, retention and transfer evidence. Use a finite, source-verified question bank from up to 3 cached batches. Four new tables, after a quality spike and rule simulation pass.
**Why:** Mixed and higher-order retrieval supports higher-order performance better than fact practice alone. Computed status lets rules change without migration, and quote checks catch invented sources.
**Cost:** Four tables and up to 3 successful AI batches per chapter. Selected-response questions can't show free recall or original explanation.
**Details:** [tasks/feature-5-concept-check/](../tasks/feature-5-concept-check/README.md).
