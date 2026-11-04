# Prompt log — AI topic breakdown (feature 5, my feature #1)

## Prompt
> When I upload a document, have the LLM break it into key topics, show the key information visually, and give real-life examples fetched from the internet — not random analogies. Use the DeepSeek API, with Firecrawl for search.

## What the agent built
A background job (`convex/ai.ts → processCourse`) that runs right after upload:
1. **PDF → text** with `unpdf` (DeepSeek can't read PDFs). Capped at ~250k characters (~100 pages). Scanned/image-only PDFs fail with a clear message.
2. **Outline call** to DeepSeek → a mind-map outline + 4–8 topics (title, summary, 3–5 key points, and a *search query for a real-world case*).
3. **Per topic, in parallel:** Firecrawl web search → DeepSeek picks up to 2 real examples **from those search results** and writes a 5-question quiz grounded in the source.
4. Saves the topics; the course page updates live (Convex reactivity) from "Processing…" to the topic list.

## Guardrails against made-up examples
- The model must cite examples by the *number* of a search result. The code throws away any example that doesn't point to a real result, and uses the URL from Firecrawl, never one the model typed.
- Quiz questions without exactly 4 options or with an invalid answer index are dropped.

## Problems hit
- DeepSeek's model list has changed: `deepseek-chat` is gone, and the current models are `deepseek-flash` (V4.1) and `deepseek-v4-pro`. Defaulted to `deepseek-flash` (overridable with the `DEEPSEEK_MODEL` env var).
- **The DeepSeek account had no balance**, so the first real run failed with "Insufficient Balance". The app showed it on the course page with a **Try again** button instead of hanging, which is exactly why the failure path exists.
