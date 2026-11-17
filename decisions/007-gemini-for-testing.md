# 007. A free Gemini model for testing; DeepSeek stays the default
**Date:** 2026-11-14 · **Status:** accepted for testing only (approved by Hemanth)

**Context:** Building chat means many AI calls while testing, and DeepSeek calls cost money.
**Decision:** `llm.ts` picks the AI service from `LLM_PROVIDER`. Unset means DeepSeek (as before). `gemini` sends calls to Google's OpenAI-compatible endpoint with `GEMINI_API_KEY` and `GEMINI_MODEL` (default `gemini-flash-lite-latest`). Set only on the dev deployment. The key lives in the gitignored `.env.local` and in Convex env, never in git.
**Why:** Free testing of retrieval, citations, limits and UI. Cost: answer quality differs from DeepSeek, so final quality is checked with DeepSeek. Free tiers may use prompts to improve Google products, so only generated test books go through it, never real ones. Don't use it in production.
