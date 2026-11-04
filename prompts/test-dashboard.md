# Prompt log — Test 2: Dashboard stat

## Prompt
> Write the dashboard test from PLAN section 4: given attempts of 4/5, 3/5, and 5/5, the average quiz score is exactly 80% and quizzes taken = 3. Show red, then green.

## Plain-English explanation (for the PR)
The test hands `computeStats` (the exact function the dashboard uses) three quiz attempts: 4/5, 3/5, and 5/5. It checks that the average is 80% ((80 + 60 + 100) ÷ 3), that 3 quizzes were taken, that only 2 count as "this week" (the third is 10 days old), and that 2 of 3 topics are mastered. A second test checks that a brand-new user sees "—" (null) instead of a misleading 0%.

## Red, then green
- **Break:** averaged the raw scores (4, 3, 5) instead of the percentages.
- **Red:** `AssertionError: expected 4 to be 80` → `Assignment/test-evidence/dashboard-RED.txt`
- **Revert → green:** 2 passed → `Assignment/test-evidence/dashboard-GREEN.txt`

## What would break it
Changing the average to use raw scores, or to `total correct ÷ total questions`, would make it disagree with this test as soon as quizzes have different lengths; so would changing the 7-day window for "this week".

## Update: adaptive checks (feature/adaptive-checks)

The 5-question quizzes were replaced by adaptive checks, so this test now uses **answers** instead of quiz attempts.

**Plain English:** the test gives `computeStats` (the function the dashboard uses) five answers across three pillars:
three right and two wrong. It checks that accuracy is exactly **60%**, 5 were answered, 3 this week, and that
exactly **2 pillars are mastered**: one got its *apply* question right, one got its *stretch* question right
after missing *apply*. The third pillar only got the *easier* question right, which does **not** count as
mastery (it shows recall, not understanding). A second test checks a new user sees "—", not 0%. A third
checks chart days split at the learner's local midnight (an answer at 11:30 pm Pacific counts for that day, not the next).

- **Break:** let *any* correct answer master a pillar (dropped the apply/stretch condition in `pillarState`).
- **Red:** `AssertionError: expected 3 to be 2` (the easier-only pillar was counted) → `Assignment/test-evidence/dashboard-RED.txt`
- **Revert → green:** 3 passed → `Assignment/test-evidence/dashboard-GREEN.txt`

**What would break it:** loosening the mastery rule, counting answers outside the 7-day window as "this week",
or bucketing chart days in UTC.
