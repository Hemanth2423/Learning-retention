# 002. Read the PDF once; build lessons on demand
**Date:** 2026-11-04 · **Status:** accepted (replaced the per-topic design from PR #12)

**Context:** V1 sent the full PDF with every topic call (~7× per document) and still came back in chapter order.
**Decision:** One strong-model call (DeepSeek v4-pro) turns the PDF into a concept model. Every later step (lessons, questions, placement) uses only that model plus web results, on the cheaper flash model, and only when the learner opens it.
**Why:** It's better and cheaper at the same time: ideas get grouped by meaning, not chapter, and the token cost drops. Cost: the first map takes ~90s, and each new lesson takes 20–40s.
