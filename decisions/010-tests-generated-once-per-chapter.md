# 010. A chapter's test is generated once and reused
**Date:** 2026-11-17 · **Status:** accepted 2026-11-17

**Context:** "Test yourself" asks 5 multiple-choice questions on a chapter. AI calls cost money and time.
**Decision:** The first "Test yourself" on a chapter generates 5 questions from that chapter's pages (never the whole book) via `llm.ts`, and stores them. Retakes and "Review missed questions" reuse them. Answer keys stay on the server, and grading happens there.
**Why:** One AI call per chapter, instant retakes, and fair scores. Cost: retakes see the same questions (fine for review).
