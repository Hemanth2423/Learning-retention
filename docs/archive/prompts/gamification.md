# Prompt log: XP, streaks, levels and achievements

## The prompt

> We need to try and gamify and make the app cool to use (Codeacademy is a great example)

I attached screenshots of Codecademy's achievement cards ("Course Completed: Learn SQL", with dates). This is roadmap row 5 in [PLAN-V2.md](../PLAN-V2.md). The rule from LEARNING-SCIENCE.md: reward effort and coming back, never cramming.

## What was built

- **XP** (`convex/gamification.ts`):
  - every answer earns 2, because trying counts
  - a right answer adds 5 (warm-up), 10 (core) or 15 (stretch and connect)
  - a review on Today adds 5
  - a comeback (right after a miss on the same pillar) adds 5
- **Levels:** Curious → Learner (100) → Thinker (300) → Expert (700) → Sage (1500).
- **Streak:**
  - any lesson or review answer on a new local day keeps it going
  - missing exactly one day uses a freeze (you start with 1, earn 1 per 7-day streak, max 2)
  - the header dims the 🔥 until you've answered today
- **Achievements** (`convex/rewards.ts`), awarded at most once each:
  - First Step
  - Pillar Mastered
  - Course Completed (every pillar mastered)
  - Idea Ingrained (from Today)
  - Comeback (right after 2 misses)
  - Streak 3/7/30
  - Level Up
- **One place for all of it:** `recordActivity` runs after every graded answer (lesson, review and end-of-course).
- **UI:**
  - "+N XP" and "🏆 Achievement unlocked" right in the answer feedback
  - a 🔥 streak · level · XP chip in the header that links to `/achievements`
  - the achievements page has a level progress bar, a streak card, dated round-badge cards like Codecademy's, and locked "Up next" cards
- No leaderboards, on purpose.

## Bug caught by a test

On a second answer in the same day, the streak update returned the whole profile, and saving it copied the old XP over the new XP, so XP only went up once a day. Now only the streak fields are saved.

## Verification

- `npm test`: 34 passing. New tests cover:
  - the XP math and levels
  - the streak on consecutive days, after a gap, with a freeze, at local midnight in another time zone, and a freeze earned at 7 days
  - an achievement awarded only once
  - Course Completed, a comeback bonus, XP adding up and the streak across fake days
  - another user seeing nothing
- In the browser (dev): the first answer showed "+2 XP" and "First Step", and the header showed "🔥1 · Curious · 2 XP". The achievements page showed the level bar, the streak, a dated card and the locked "Up next" cards.

## Note

XP and streaks start from zero when this deploys. Earlier answers don't count retroactively.
