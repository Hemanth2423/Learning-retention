# Prompt log — Dashboard (feature 10)

## Prompt
> Build feature 10: a dashboard with summary stats (courses, topics mastered out of total, average quiz score, quizzes this week) and a chart of quiz scores over time.

## What the agent did
- `computeStats()` in `convex/progress.ts` is a **pure function** (rows in → numbers out), so the dashboard test can check it directly.
  - **Average quiz score** = the mean of each attempt's % (rounded).
  - **Topics mastered** = topics whose best attempt is ≥ 80%.
  - **Quizzes this week** = attempts in the last 7 days.
- `dashboard.stats` query: loads only the logged-in user's rows and calls `computeStats`.
- `/dashboard`: 4 stat tiles + a Recharts line chart (one dot per attempt, hover tooltip, a dashed "Mastery" line at 80%), using the app's theme colors so it works in dark mode.

## Verified
With 1 course, 5 topics, and one 4/5 attempt: Topics mastered 1/5, Average 80%, Quizzes this week 1, and one dot on the chart at 80%.
