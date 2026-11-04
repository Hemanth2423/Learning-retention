# Prompt log — Fix: quiz answers were predictable

## The prompt

> Credit added, go. (Run a real PDF end-to-end through the AI breakdown and check the output.)

## What happened

First real end-to-end run on `public/_test/memory.pdf` (6 topics). Everything worked:
mind map, summaries, key points, web-sourced examples with real links, 5 quiz questions per
topic, and AI next steps with real resources.

**Bug found while checking the output:** the correct answers followed a pattern. In almost every
topic the answers were A, B, C, D in order (`0,1,2,3,…`). The prompt already said "spread the
correct answer across positions 0–3", and the model followed it too literally. Anyone who noticed
could pass every quiz without reading, which defeats "mastery".

## Fix

Don't trust the LLM with randomness. `convex/ai.ts` now shuffles each question's four options
in code (Fisher–Yates) and moves `answerIndex` to where the correct option ended up.

## Verification

- Reprocessed the course. Answer positions per topic became e.g. `C B C B D`, `A A B A D`, `B B B A A`.
- Took topic 1's quiz in the browser with 4 of 5 correct and got **4 / 5 — 80%, Mastered**, so
  server-side grading still matches the shuffled options.
- `npm test` passes (3 tests).

## Also checked (not bugs)

- One topic got **0** web examples. The page shows "No well-sourced real-world examples were found
  for this topic." This is intended, because examples are kept only if they come from a real search result.
- Some "real-world" examples are research studies (e.g. Roediger & Karpicke) rather than
  companies or products. They are real and sourced, so I kept them.
