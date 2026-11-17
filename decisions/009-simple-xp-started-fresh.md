# 009. Simple XP, levels and streaks, started fresh
**Date:** 2026-11-17 · **Status:** accepted by Hemanth (amounts proposed, not built)

**Context:** The old app has XP, levels and achievements (`profiles`, `achievements`, `gamification.ts`) built for a different design.
**Decision:** Start fresh with one `learnerStats` row per user. Reading a chapter 10 XP, a note 20 XP, each right test answer 10 XP. Level up every 100 XP. Streak = days in a row with any XP. No stars. XP is only ever added on the server, once per chapter per action.
**Why:** Simple to understand and to test, and it rewards reflection and testing more than reading. Cost: the legacy tables stay unused until removed.
