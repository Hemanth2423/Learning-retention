# Ingrain V2: plan

V1 turned a PDF into a concept map, visual lessons and a few checks. V2 turns Ingrain into a learning app you come back to every day. Every decision here traces to [LEARNING-SCIENCE.md](LEARNING-SCIENCE.md).

## Vision

Learn anything in a fraction of the time it takes to read the book, and actually keep it. Ingrain finds the few ideas that matter, teaches the *why* behind each one, makes you think instead of reread, brings each idea back right before you'd forget it, and saves what you learned into your own notes.

## Product principles

1. **Three taps to start.** Pick what you want to learn, take a 1 minute placement check, start the first lesson. No forms.
2. **Fun like Codecademy.** XP, streaks, levels and achievement cards. But rewards go to *thinking and coming back*, never to scrolling or cramming.
3. **Thinking, not reading.** Every screen asks something of you. The question mix changes so it never feels like a quiz.

## The learner journey

```
1. What do you want to learn?   ──►  "Agentic AI"  or  drop in a book/PDF
2. Quick placement check        ──►  4–6 questions, ~1 min → skip what you know
3. Your map                     ──►  core ideas, prerequisites first, your gaps highlighted
4. Learn one idea               ──►  predict → lesson (why first) → 4–6 varied questions
5. Session end                  ──►  XP, streak, "Tomorrow: 3 reviews + next idea" (future tag)
6. Come back                    ──►  Today's review: interleaved, spaced, short
7. Ingrained                    ──►  an idea recalled across 3 spaced sessions earns its badge
8. Keep it                      ──►  export to Markdown (Obsidian) → later MCP to Notion/Obsidian
```

### 1. Start: book or topic
- **Home is one question:** "What do you want to learn?" It has a text box plus a (+) to drop in a PDF.
- **Topic mode (no book)** is a premium feature. The AI drafts the concept model for the topic, and Firecrawl fills each idea with real sources and citations. **V2 ships one curated topic: Agentic AI.** We use it to tune quality before opening up any topic.
- **Book mode** is today's upload, unchanged underneath.

### 2. Placement check (find your level)
- 4 to 6 questions, about one per core idea, written in the same concept-model call (no extra AI cost).
- Each question includes "I don't know yet" (no guessing penalty).
- Result: each idea is marked **Known** (skip ahead, goes straight to spaced review), **Shaky** (short lesson) or **New** (full lesson).
- Shown as "You already know 2 of 6 ideas. Your path is about 25 min."

### 3. The map
- Keep the V1 concept map (one level open, (+) to expand).
- Add a node state: locked, new, in progress, learned, ingrained. Ideas unlock once their prerequisites are learned, so the map doubles as a course path.

### 4. Learning one idea (the core loop, about 5 to 8 minutes)
1. **Predict first.** One question *before* the lesson ("What do you think happens if…?"). Wrong is fine. It primes curiosity (pretesting).
2. **Lesson, why first.** Hook → the *why* (what problem this idea solves) → visual → 3 to 5 takeaways → common trap → real example.
3. **Practice set: 4 to 6 questions, mixed types** (see the question engine below). Difficulty adapts: a miss gives an easier one, a hit gives a stretch.
4. **Explain it.** One "explain it to a friend" free answer per idea, graded by a cheap model against a rubric from the concept model.
5. **Wrap.** Show what you got right, the one thing to remember, and when it comes back.

### 5. Spaced review ("Today")
- Each idea has a review schedule. The first review comes the next day, after sleep. Then the gaps expand (about 1, 3, 7, 21 days), stretched when you recall easily and shrunk when you miss.
- **Today** is a 3 to 5 minute session of mixed questions from different ideas and courses (interleaving), drawn from the stored question bank, so **reviews cost zero AI tokens**.
- An idea becomes **Ingrained** after 3 successful recalls on 3 different days, with at least one at 7+ days. That replaces "mastered after one right answer".

### 6. Knowledge base
- **V2:** "Export to Markdown" downloads a zip. It has one `.md` note per idea (summary, why, takeaways, trap, examples with links, your own explanation) plus a course index note, using `[[wiki links]]` that mirror the concept map. It drops straight into Obsidian.
- **Later:** an MCP connection to push notes into Notion or Obsidian directly.

## Question engine

Variety is driven by the science, and most questions are graded by code, so they're free.

| Type | Graded by | Why it's there |
|---|---|---|
| Predict first | code (no penalty) | pretesting, curiosity |
| Multiple choice: apply to a new case | code | transfer |
| Spot the misconception ("A colleague says…") | code | error correction |
| Order the steps (drag) | code | structure, schemas |
| Match idea ↔ example (tap pairs) | code | relational binding |
| Which idea applies? (mixed review) | code | interleaving |
| Fill the gap (type a key term) | code, fuzzy match | free recall |
| Why is this true? | code (pick the best reason) | elaborative interrogation |
| Explain it to a friend | cheap AI model + rubric | self-explanation |
| Confidence (sure / not sure) on each answer | — | calibration, beats the illusion of learning |

Rules that stay in code (from V1): never "according to the source", shuffle the options, grade on the server, wrong options come from the real misconceptions.

## Gamification (Codecademy-style, science-aligned)

- **XP:** earned for answering, more for getting a hard one right, *and* for retrying after a miss (effort counts). Daily review gives bonus XP.
- **Streak:** one review or one lesson a day keeps it. Includes a streak freeze, because a single missed day shouldn't kill motivation.
- **Levels:** XP thresholds with names (Curious → Learner → Thinker → Expert → Sage).
- **Achievements page:** cards like Codecademy's, e.g. *Idea Ingrained: Tool Use*, *Course Completed: Agentic AI*, *7-day streak*, *Comeback: got it right after 2 misses*. Each card shows a date.
- **Progress ring per course:** learned versus ingrained.
- **No leaderboards in V2.** Comparing yourself with others pushes people toward cramming, which works against spacing.

## What changes underneath

**Data model** (details go into schema.md when each piece is built):
- `courses`: + `source` (`upload` | `topic`), `fileId` becomes optional for topic mode.
- `topics`: + `questionBank` (6 to 10 typed questions, replacing the 3 fixed `checks`), + `placement` question, + `explainRubric`.
- `answers`: + `type`, `confidence`, `xp`, `context` (`lesson` | `review` | `placement`).
- **New `reviews`:** userId, topicId, `dueAt`, `intervalDays`, `ease`, `successes`, `state` (new / learning / learned / ingrained).
- **New `profiles`:** userId, `xp`, `level`, `streak`, `lastActiveDay`, `freezes`.
- **New `achievements`:** userId, `kind`, `refId`, `earnedAt`.

**Token cost per document stays about the same.** Placement and explain-rubrics come out of the existing concept-model call, and each lesson call writes a bigger question bank (a little more output, no extra calls). Reviews and placement grading are free. The only per-answer cost is one "explain it" grading per idea on the flash model.

## Roadmap (one issue and PR each, in order)

| # | PR | Done means |
|---|---|---|
| 1 | Science doc and this plan | merged |
| 2 | Question engine: typed question bank and 6 new question components | a lesson shows 4 to 6 mixed questions, all graded on the server |
| 3 | Predict-first and why-first lessons | the lesson opens with a prediction, and the hook explains the problem the idea solves |
| 4 | Spaced review and the Today page | missing a question schedules it sooner. Today mixes ideas. Ingrained needs 3 spaced recalls |
| 5 | Gamification: XP, streak, levels, achievements page | tested: XP math, streak across days and time zones, achievement awarded once |
| 6 | Placement check and map node states | known ideas get skipped, and the path time estimate is shown |
| 7 | New home and 3-step onboarding | a new user reaches their first question in under 60 seconds |
| 8 | Topic mode: Agentic AI (premium flag) | Agentic AI course built from AI plus web, with citations |
| 9 | Explain-it with AI grading | free answer graded against a rubric, with feedback on what was missing |
| 10 | Markdown export (Obsidian-ready zip) | the zip opens in Obsidian with working links |
| Later | MCP to Notion/Obsidian, open topic mode, payments for premium | — |

## How we'll know it works

- **Retention, not completion:** the percentage of ideas recalled correctly at the 7-day review. The goal is 70% or more.
- **Return rate:** the share of learners who come back the next day for their first review.
- **Time to first question** for a new user: under 60 seconds.
- **Calibration:** the gap between "sure" and actually correct shrinks over time.

## Open questions (for later)

- What's in premium besides topic mode, and what does it cost?
- Should topic mode let you pick depth (overview / working knowledge / deep)?
- Mobile-first layout for daily review?
