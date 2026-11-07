# Ingrain: Architecture

Read this before changing any component listed here. It describes the system **as built today** (main @ `14a43fe`). Parts may be removed as the new vision lands.

## System map

```
Browser (Next.js 16, React 19, Tailwind 4)  ── hosted on Vercel
   │  Convex React client (live queries, mutations)
   ▼
Convex (backend + database + file storage + auth)
   │  scheduled background actions
   ├──► DeepSeek  v4-pro  (reads the PDF once → concept model)
   ├──► DeepSeek  flash   (lessons, placement, capstone, next steps)
   └──► Firecrawl search  (real-world examples with links)
```

## The core pipeline

1. **Upload:** the browser uploads the PDF straight to Convex storage → `courses.create` schedules `ai.processCourse`.
2. **Read once:** `unpdf` extracts the text → **v4-pro** returns the concept model (thesis, 4–7 pillars, insights, misconceptions, links) → saved by `processing.saveConceptModel`.
3. **Lessons on demand:** opening a pillar calls `lessons.ensure` → **flash** builds the lesson from the concept model + Firecrawl results only. Pillar 1 is built at upload, and the next pillar is prefetched.
4. **Answer:** graded on the server (`checks.ts`, `reviews.ts`, `placement.ts`) → saved in `answers` → `recordActivity` updates XP, streak and achievements.

## Modules (`convex/`)

| Area | Files | Owns |
|---|---|---|
| Auth + access | `auth.ts`, `helpers.ts`, `users.ts` | Who the user is (`requireUser`, `getOwnCourse`) |
| Courses | `courses.ts`, `validation.ts` | Upload, edit, delete, reprocess |
| AI pipeline | `ai.ts`, `processing.ts`, `llm.ts` | PDF → concept model; every LLM call + token log |
| Lessons | `lessons.ts`, `lessonTypes.ts`, `lessonRules.ts` | Building and validating lessons |
| Questions | `questionRules.ts`, `questionFlow.ts`, `checks.ts` | Question rules, order, grading, capstone |
| Retention | `reviews.ts`, `spacing.ts` | Spaced-review schedule, the Today page |
| Placement | `placement.ts`, `progress.ts` | Placement check, pillar states, time estimate |
| Motivation | `gamification.ts`, `rewards.ts` | XP, levels, streaks, achievements |
| Other | `stars.ts`, `topics.ts`, `dashboard.ts`, `nextSteps.ts` | Stars, search, stats, next-step suggestions |

UI: `app/` holds the pages and `components/` the shared pieces (`practice/` holds the question UI).

## Data ownership (`convex/schema.ts`)

| Table | One row per | Written by |
|---|---|---|
| `courses` | uploaded PDF (+ concept model) | courses, processing |
| `topics` | pillar (+ lesson, question bank) | processing, lessons |
| `answers` | graded answer | checks, reviews |
| `reviews` | mastered pillar's review schedule | reviews, placement |
| `profiles` | user's XP, level, streak | gamification |
| `achievements` | earned badge | rewards |
| `stars` | starred pillar | stars |

## Contracts (break these and something breaks silently)

- **Every public query and mutation calls `requireUser`.** The user comes from the session, never from the browser. Tested in `dataIsolation.test.ts`.
- **Only the concept-model step sees the full PDF.** Every later AI step works from the concept model.
- **Question rules live in code, not in prompts** (`questionRules.ts`): no "according to the source", options are shuffled, answers are graded on the server, and answer keys never reach the browser.
- **Every LLM call goes through `llm.ts`**, which logs `[tokens]` to the Convex logs.
- **AI runs only in actions** (scheduled from mutations), never in queries.
- **Placement and predict answers are diagnostics.** They don't count toward accuracy or mastery.
