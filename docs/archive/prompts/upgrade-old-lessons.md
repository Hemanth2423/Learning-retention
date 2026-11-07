# Prompt log: Upgrade old lessons when opened

## The prompt

> I seem to be seeing the same old app though

## What was going on

The deploy was fine: the live lesson page served the new code. But a lesson's content is built once, the first time a pillar is opened, and then saved. Lessons built before PR #54 and PR #56 kept their 3 old multiple-choice checks and had no guess or why cards, so they looked unchanged.

## What was built

- `lessons.ensure` now rebuilds a ready lesson that has no question bank (`isOldLesson`), in the same background job as a new lesson. Answers, mastery and stars are in other tables, so they're kept.
- While a rebuild runs, the page shows "Upgrading this lesson to the new format…" instead of the old lesson, so nothing swaps in the middle of a practice round.
- Opening a pillar also prefetches the next one, so that one gets upgraded too.

## Cost

One flash lesson call per old pillar that someone opens (about 2.3k tokens in and 4.5k to 5k out). Pillars nobody opens are never rebuilt.

## Verification

- New test: opening an old lesson queues a rebuild, and opening a new one doesn't. 19 tests pass.
- On dev, opening "Forgetting" and "Working Memory" rebuilt each once (7:24 PM in the logs). Both now show the problem/idea cards and the mixed practice bank. "Working Memory" skips the guess because it already had answers.
