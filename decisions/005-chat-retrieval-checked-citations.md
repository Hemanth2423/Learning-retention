# 005. Chat uses retrieval and checked citations; AI only on request
**Date:** 2026-11-14 · **Status:** accepted · **Replaces:** [002](002-read-once-concept-model.md)

**Context:** Cited chat needs the book's text at question time. The old rule (only the concept model sees the full PDF) can't deliver that.
**Decision:** Ingest is plain code (no AI). A question runs Convex text search over the document's chunks (top ~30); code re-ranks to favor the reader's current chapter and keeps ~6, which go to DeepSeek flash with their locators. Citations not in that set are dropped. "Summarize" uses the current chapter. Chat is capped at 5 questions per user per day (counted from `chatMessages`, rolling 24 hours, enforced on the server). The model never sees the whole book. Answer quality is tuned later.
**Why:** A 25 MB book can be 200k+ tokens, so per-question full-text is slow and costly. Search is built into Convex, so no new vendor. Cost: keyword search can miss paraphrases. Upgrade path: embeddings (needs approval).
