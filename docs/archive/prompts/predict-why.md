# Prompt log: Predict-first and why-first lessons

## The prompt

> I start with high level ideas and go deeper into understanding each. Understand why behind each concept

This is roadmap row 3 in [PLAN-V2.md](../PLAN-V2.md). It's based on LEARNING-SCIENCE.md: pretesting (a guess before learning makes the lesson stick, even when it's wrong), elaborative interrogation (asking why) and future-relevance.

## What was built

- **Predict first:** on a first visit, the lesson opens with one guess question, and the lesson is shown after the guess or a Skip.
  - It's framed as a guess, never as "wrong": "Good instinct." or "Interesting guess.", followed by the reveal.
  - It's graded on the server so the answer can be shown, but **never recorded**, so a guess can't hurt accuracy or mastery.
  - It's skipped once you've answered any practice question on that pillar.
- **Why first:** two cards, "The problem" (what goes wrong without this idea) and "The idea" (how it fixes it), come before the visual.
- Both come from the same lesson call (no extra AI call), and old lessons without them still render.

## Bug fixed along the way

The "no mentioning the source" rule threw away good questions. The `[question dropped]` logs from PR #54 showed 3 of 7 Encoding questions rejected for scenarios like "a student re-reads and highlights the chapter". The rule now blocks only references to the material as the authority:
- "according to"
- "the author"
- "this chapter"
- "the text says"

A scenario that happens to mention a chapter is allowed. After the fix, the rebuilt lesson kept all 7.

## Verification

- `npm test`: 18 passing. New tests:
  - the prediction's answer survives shuffling and is hidden from the browser
  - answering the prediction is never saved (the dashboard still shows 0 answered)
  - the narrowed source rule blocks and allows the right sentences
- In the browser: the guess shows first, a wrong guess gets the soft framing, "Start the lesson" reveals the why cards, then the visual, and practice has a full bank. Match was checked at phone width.

## Note

The first generated prediction was fairly obvious (explain-and-diagram beats highlighting). The prompt asks for "a little surprising", but this may need tuning once we see more lessons.
