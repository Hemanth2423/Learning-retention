# Prompt log: Placement check and map node states

## The prompt

> I have the required books / I want to start from scratch. I want to understand everything in this book while spending a fraction of time / I want to learn the concept (The user might have an existing level of expertise and want to learn accordingly)

When the agent asked how to find a learner's level, I picked "short placement check". This is roadmap row 6 in [PLAN-V2.md](../PLAN-V2.md).

## What was built

- **Placement check** (`convex/placement.ts`):
  - offered on a course before you've answered anything, with "I'm new to this" to skip it
  - one scenario question per pillar, each with an "I don't know yet" option
  - right → **Known**: the lesson is skipped and its first spaced review lands tomorrow to confirm it
  - wrong → **Shaky**: the lesson's guess question is skipped, since you just guessed
  - don't know → **New**
  - like the guess question, nothing here is saved to `answers`, so a diagnostic doesn't count toward accuracy or mastery
- **Pillar states** (`nodeState` in `convex/progress.ts`): new, in progress, known, learned and ingrained. They show on:
  - the path: ◆ Known, ✓ Learned, ✦ Ingrained, ◐ In progress
  - the concept map, with a colored dot per pillar and a legend
  - the lesson stepper
- **Time estimate** (`pathMinutes`): about 6 minutes per new idea, 4 for one you've started or guessed at, 0 for known or learned. For example: "You already know 3 of 5 ideas… Your path is about 12 minutes."
- A known pillar's lesson page says it can be skipped and will come up on Today.

## Deviation from the plan

The plan put the placement questions in the concept-model call (no extra cost). Instead, they're written by one small flash call when the learner starts the check, so the check also works for courses uploaded before this PR. It costs about 0.9k tokens in and 1.9k out per course, once.

## Verification

- `npm test`: 36 passing. New tests:
  - state and time rules
  - placement right/wrong/don't know → known/shaky/new
  - known schedules a review for tomorrow
  - answer keys are hidden
  - the check completes when all are answered
  - nothing is scored
  - another user can't answer
- In the browser (dev, on a cloned course that was deleted afterwards): I generated the check, answered 5 questions (3 known, 2 don't know), got "about 12 min left", and saw ◆ on the path, green dots on the map and "Start here" on the first new idea.
