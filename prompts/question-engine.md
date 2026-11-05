# Prompt log: Question engine

## The prompt

> I feel questions & variety of questions, problems and active thinking is needed for learning -> So, we need to ensure great variety of questioning, in an organic guided manner.

This is roadmap row 2 in [PLAN-V2.md](../PLAN-V2.md). I chose "mostly code-graded questions, AI grading used sparingly", so every type in this PR is graded by code, with no AI cost per answer.

## What was built

- **A typed question bank** (`topics.questions`) replaces the 3 fixed checks. Each lesson call now asks for 7 questions:
  - apply it (new scenario)
  - spot the mistake
  - match pairs
  - put it in order
  - fill the gap
  - why is it true
  - a stretch case
- **Rules in code** (`convex/questionRules.ts`):
  - drops malformed questions and anything mentioning "the source"
  - shuffles options, items and pairs, and never shows steps already in the right order
  - rejects a gap whose answer already appears in the sentence
  - keeps a bank only if it has 4+ questions, 3+ types, and both an apply and an easier question
- **Grading on the server** (`checks.answerQuestion`) for every type:
  - fill-the-gap ignores case, punctuation and "the", and allows one typo in words of 5+ letters (two at 10+)
  - answer keys never reach the browser
- **Adaptive flow** (`convex/questionFlow.ts`): starts at Core. A miss moves to a Warm-up and a hit to a Stretch, the type changes each time, and a round is 5 questions.
- **UI** (`components/practice/`): one card per type. Order and match are tap-based (it works on phones, and no drag library is needed). A progress bar shows each answer as right or wrong, then a summary at the end.
- **Old lessons** keep working: their 3 checks are served as choice questions.
- The legacy `PillarChecks`, `answerPillar` and `cleanChecks` were removed (all now unused).

## Bugs caught while testing in the browser

- **Match dropped quick taps**: the right column was disabled until a term was picked, and the handler read a stale selection. Fixed with one state object and functional updates.
- **Fewer questions than asked for**: one lesson ("Retrieval Practice") kept only 4 of 7 questions. Each dropped question is now logged (`[question dropped]`), so the cause can be seen. A likely suspect is the "no mentioning the source" rule matching normal phrases in study-skill topics, like "re-read the chapter".

## Cost

One lesson call, as before. Output grew a little: 3.5k to 4.4k tokens including reasoning, on the flash model. Reviews and grading cost nothing.

## Verification

- `npm test`: 15 passing, including new tests for cleaning, shuffling, hiding answers, grading each type, typo tolerance, V1 fallback and the adaptive flow.
- In the browser, a fresh lesson was generated with all 7 questions kept. Tested every type, wrong and right; miss → easier and hit → harder; the end-of-round summary; and mastery. An old V1 lesson still shows its questions.
