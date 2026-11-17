# 011. Groq is the default AI service
**Date:** 2026-11-17 · **Status:** accepted (asked for by Hemanth)

**Context:** Gemini's free tier ran out quickly while testing, and DeepSeek costs money per call.
**Decision:** `llm.ts` now uses Groq when `LLM_PROVIDER` is unset or `groq`, with `GROQ_API_KEY` and `GROQ_MODEL` (default `openai/gpt-oss-120b`, the strongest model this key offers). `deepseek` and `gemini` stay available through `LLM_PROVIDER`. The key lives in the gitignored `.env.local` and in Convex env, never in git. Updates ADR 007.
**Why:** Higher free limits for testing, and the 120B model writes better test questions than Gemini Flash Lite. Cost: final quality and cost are still checked before launch, and free tiers may keep prompts, so only test books go through it.
