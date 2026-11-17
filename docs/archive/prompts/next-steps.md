# Prompt log — Honest progress report + next steps (feature 11, my feature #4)

## Prompt
> Be realistic about what the person has learned and show next steps (e.g., what concepts they need to learn next, and share actual resources).

## What the agent did
- `components/ProgressReport.tsx` on each course page. **Only quiz results count as learned**, not opening or reading a topic:
  - Mastered (best ≥ 80%) / Needs work (tested, < 80%) / Not tested
  - A plain verdict, e.g. "You've proven 1 of 5 topics. Untested topics don't count as learned."
- "Suggest what to learn next" → `nextSteps.suggest` action:
  1. sends DeepSeek the topic list with each best score
  2. asks for 3–5 next concepts (a prerequisite first if something is weak, otherwise what comes *after* this material)
  3. runs a Firecrawl search per concept and attaches the top **real** result as the resource link
  4. saves to `courses.nextSteps`
- The action checks login and course ownership itself, because actions don't get the query helpers.

## Status
- Verified the report groups and the verdict in the browser.
- The AI suggestion step reached DeepSeek and showed the "Insufficient Balance" error inline. Needs credit on the account to verify end-to-end.
