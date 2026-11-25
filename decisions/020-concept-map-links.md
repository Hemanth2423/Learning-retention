# 020. Concept map: typed links from an ontology vocabulary
**Date:** 2026-11-24 · **Status:** accepted (Hemanth approved real links "derived from ontologies" on 2026-11-24)

**Context:** The concept map in mockup 007 joins ideas with labelled links, but saved ideas had no relationships.
**Decision:** Add optional `links` and `linkTries` to `conceptChecks`. Each link is `{from, to, type, note}`, and `type` is one of 7 relations from RDFS/SKOS, the OBO Relation Ontology and BFO (`conceptRules.RELATIONS`). One small AI call per check maps them, run after the first batch or when an older check's map first opens, with at most 2 tries. Code drops unknown ideas, self-links, repeats and unknown types. Layout uses `d3-force` 3.0.0 (ISC), run for a fixed number of steps.
**Why:** A fixed vocabulary keeps links checkable in code and comparable across books, unlike free-text labels. A separate call leaves the tuned question prompt untouched and backfills old checks.
**Cost:** One more dependency, and one small AI call per chapter that reads the chapter text again.
**Details:** [tasks/feature-5-concept-check/7-map-and-dashboard.md](../tasks/feature-5-concept-check/7-map-and-dashboard.md).
