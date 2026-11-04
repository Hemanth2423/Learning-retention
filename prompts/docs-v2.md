# Prompt log: Docs for v2 (schema.md + README)

## The prompt

> (Follow-up to the concept model and adaptive checks PRs: keep the docs true to what's built.)

## What changed

- **schema.md:** new ER diagram and tables. `topics` are now pillars (sub-ideas, insights, misconceptions, on-demand
  lesson, checks); `answers` replaces `quizAttempts`; courses gained `thesis`, `conceptLinks`, and `capstone`.
  The plan-vs-built section explains each change.
- **README:** the feature list and "How it works" describe the concept model, on-demand lessons, adaptive checks,
  and token logging. The test list includes the new rule tests.

## Bug caught

My first `schema.md` rewrite didn't save (the edit tool refused to overwrite a file it hadn't read in this session),
so the adaptive-checks PR shipped without it. Caught it when checking the diff, and fixed it here.
