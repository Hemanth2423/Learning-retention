# Prompt log: Spaced review and the Today page

## The prompt

> Keep checking my progress into understanding

This is roadmap row 4 in [PLAN-V2.md](../PLAN-V2.md). It's based on LEARNING-SCIENCE.md: spacing and practice testing (Dunlosky's two "high utility" techniques), Kandel's "repeated, spaced" switch from short-term to long-term memory, sleep consolidation, and interleaving.

## What was built

- **The schedule** (`convex/spacing.ts`, pure functions):
  - mastering a pillar starts a review due the next day, after sleep
  - a right answer grows the gap: 1 → 3 → 7 → 21 days, then ×2.5
  - a miss brings it back tomorrow
  - days split at the learner's local midnight
- **Ingrained:** 3 correct review recalls on different days, at least one after a gap of 7+ days. It replaces "mastered after one right answer" as the real finish line.
- **The `reviews` table**, created in `checks.answerQuestion` the first time a Core or Stretch question is answered right. Also:
  - a one-time `reviews.backfill` for pillars mastered before this PR
  - deleting a course now deletes its reviews too
- **The Today page** (`/today`, the first item in the nav, with a badge showing how many are due):
  - up to 5 due ideas per session, mixed across courses
  - each asks one scenario question from the stored bank, rotating, so reviews cost **zero AI tokens**
  - the session is a snapshot, so answering doesn't reshuffle the list
  - it ends with a summary, any newly Ingrained ideas, and what's coming tomorrow ("Sleep on it, that's when memories set")
- **The lesson page** shows "Next review tomorrow · recalled 0 of 3" or "✦ Ingrained".
- Review answers are saved with `context: "review"`.

## Bug caught in the browser

A correct review on the same day as its last recall didn't count (by design), but its due date didn't move either, so it stayed on Today forever. Now it still pushes the next review out; it just doesn't add a success. A test was added.

## Verification

- `npm test`: 26 passing. New tests cover:
  - the gap ladder, misses and the same-day rule
  - the Ingrained rule and the local-midnight cutoff
  - mastery creating a review, while a warm-up doesn't
  - a review due the next day that asks a scenario question with no answer keys, and a miss coming back tomorrow
  - another user being unable to see or answer your reviews
  - the backfill not creating duplicates
- In the browser (dev): I ran the backfill and made the reviews due with a temporary helper (not committed). The badge showed 2, I recalled 1 of 2, the miss moved to tomorrow, and after the fix both cleared ("Tomorrow: 2 reviews"). The lesson page shows the next review.

## After deploying

Run the backfill once on prod: `npx convex run reviews:backfill --prod`.
