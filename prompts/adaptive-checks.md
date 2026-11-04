# Prompt log: Adaptive checks (replacing the 5-question quizzes)

## The prompt (from Devi's test, then our design discussion)

> We need not necessarily have a standard 5-question progress check, which is hard and complicated. Look at the
> questions ("According to the source, what does the 'observe' step … actually involve?"). Who cares what the
> source says, we care about the actual conceptual understanding.
> *(After my proposal)* I like the Q&A logic, let's proceed. Delete the courses already uploaded.

## The rules: fixed in code, not AI judgment

Each pillar's lesson comes with a pool of 3 questions (built in the concept-lessons PR):
**apply** (a new scenario), **easier** (the core idea, directly), **stretch** (an edge case or a link to another pillar).

| Step | Shown | Right → | Wrong → |
|---|---|---|---|
| 1 | apply | **Mastered** (offer stretch for practice) | explanation, then *easier* |
| 2 | easier | explanation, then *stretch* | explanation, then *stretch* |
| 3 | stretch | **Mastered** | "Needs work": come back later; it stays on the review list |

- **Mastered** = an *apply* or *stretch* answer is correct. The *easier* question alone never masters a pillar.
- When you return to a pillar you haven't mastered, it starts at *apply* again ("You missed this one before").
- **Put it together:** 3 end-of-course questions that each need two pillars, built **on demand** from the
  concept model only (`checks.buildCapstone`).
- Grading is on the server (`checks.answerPillar` / `answerConnect`). Answers and explanations are stripped
  from `topics.get` and `courses.get`.

## What changed around it

- `quizAttempts` → **`answers`** table (one row per answer, with its level).
- `convex/progress.ts`: `pillarState` / `pillarProgress` / `computeStats` (accuracy, checks answered, this week, mastered, a daily chart).
- Dashboard: "Pillars mastered", "Accuracy", "Checks this week", and an "Accuracy over time" chart by day.
- Find, the Your path list, the progress report, the path stepper (✓ for mastered), and the next-steps prompt
  all use the new pillar state.

## Bugs caught

- **Chart said "Nov 3" for answers made on Nov 4** (Pacific). Days were bucketed at UTC midnight. The dashboard
  now sends the browser's timezone offset, and days split at local midnight. There's a test for it.
- **Answer leak I caught before shipping:** `courses.get` would have sent the capstone questions' `answerIndex`
  to the browser. It now strips them, the same way `topics.get` does.
- Path labels overlapped on a phone. Each step now has a minimum width and the row scrolls.

## Verification (browser, test PDF)

- Pillar 1: picked wrong on *apply* → explanation + "Let's step back" (*easier*) → wrong → "One more · a trickier case"
  (*stretch*) → right → "✓ Mastered".
- Dashboard: 1/5 pillars mastered, 33% accuracy across 3 answers, 3 this week.
- Progress report: "Mastered (1) · Working Memory · 1/3 right"; the path shows ✓ on pillar 1.
- "Build my final check" produced 3 cross-pillar scenarios (e.g. a nursing student and dose calculations →
  chunking + interleaving), with a misconception ("seven items") as a wrong option.
- 375 px phone width: no horizontal page scroll.
- `npm test`: 7 pass. Red/green evidence for both required tests was regenerated in `Assignment/test-evidence/`.
