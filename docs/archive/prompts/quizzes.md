# Prompt log — Topic quizzes + concept-check progress (feature 7, my feature #3)

## Prompt
> For each chapter/topic, have a short test, and record the result as concept-check progress.

## What the agent did
- Each topic has 5 AI-written multiple-choice questions (generated in feature 5).
- `quizzes.submit` **grades on the server** against the stored answers and saves a `quizAttempts` row. The topic page never receives the correct answers until you submit, so you can't peek at them in dev tools.
- After submitting: score, green/red per option, a one-line explanation per question, and a Retake button.
- **Mastery rule** (from PLAN): best score ≥ 80% → "Mastered". `convex/progress.ts` holds the pure helpers (`pct`, `bestPct`, `isMastered`).
- The course page shows each topic's best score plus an "X of Y mastered" progress bar.

## Verified
Took a quiz in the browser, answering 4 of 5 correctly → "4 / 5 — 80% · Mastered", and the best score showed in the topic header.
