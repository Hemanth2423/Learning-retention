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
