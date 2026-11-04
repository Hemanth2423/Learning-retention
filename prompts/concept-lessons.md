# Prompt log: Concept model + on-demand visual lessons

## The prompt (from Devi's test, then our design discussion)

> The map itself needs to be reasoned well … we currently show the table of contents for the doc,
> but what I want is a reasoned conceptual map (e.g. product growth → acquisition, onboarding, engagement,
> retention, monetization …).
> Key points are very bland. The idea is the user can skip reading the book and quickly gain knowledge.
> I want a conceptual and visual representation covering all the insights in the book; the real-life
> examples and questions can be part of this chapter-by-chapter progression itself.
> What is the best way to plan our reasoning system … while keeping costs in check (minimize per-document tokens)?

Decisions: build lessons on demand but show the progression (what's next); use the stronger model for step 1 only.

## Design: read once, then reason from a compact concept model

The old pipeline re-sent the **whole PDF** in every topic call (≈7× the document per course).

1. **Concept model** (`convex/ai.ts`). The full text goes to **`deepseek-v4-pro`, reasoning effort high**,
   **once**. It returns a thesis and 4–7 *pillars* grouped by idea, not by chapter, and ordered prerequisites first.
   Each pillar has sub-ideas (with finer points), insights with short supporting quotes, misconceptions,
   and a web search query, plus links between pillars.
2. **Lessons on demand** (`convex/lessons.ts`). **`deepseek-flash`** sees only that pillar's slice of the
   model plus Firecrawl results, never the PDF. It returns a hook, **one visual** from a fixed template set
   (flow, cycle, compare, 2×2 matrix, hierarchy), 3–5 teaching takeaways, a "common trap", sourced examples,
   and a pool of 3 questions (apply / easier / stretch) for the next feature.
   - Pillar 1 is built at upload. Opening pillar *n* builds it if needed and **prefetches pillar n+1**,
     so "Next" is usually instant. Pillars nobody reaches cost nothing.
3. **Rules in code, not AI judgment** (`convex/lessonRules.ts`). Questions that mention "the source/text/author/chapter"
   or "according to" are rejected. Options are shuffled. A malformed visual falls back to drawing the
   pillar's own sub-ideas, so a lesson always has a picture. If the questions fail the rules, there is one retry.

The UI draws the visuals (`components/LessonVisual.tsx`); the AI only fills in the data. That's much
cheaper than generating images. Progression: a stepper on every lesson (`PillarPath`), a "Next up" card,
and a "Your path" list with "Start here" on the course page.

## Token use (memory test PDF, from the `[tokens]` log lines)

| Call | Model | In | Out (of which reasoning) |
|---|---|---|---|
| Concept model | v4-pro, high | 1,155 | 12,902 (10,207) |
| One lesson | flash | ~1,700 | ~2,200–3,300 (1,000–2,100) |

For a real 40-page chapter (~30k tokens), input drops from ~7 × 30k ≈ 210k to ~30k + 2k per *opened*
pillar. The biggest remaining cost is the concept model's **reasoning output**. If its quality holds at
`effort: "low"`, that's the next lever to pull.

## Bugs caught

- **Every lesson failed with "Couldn't write good questions".** The questions themselves were good, but the model
  left out the `level` field or called it `type`, because my prompt never showed it in the JSON example. Fixed both
  ways: the prompt now shows `level` explicitly, and `cleanChecks` falls back to position order. A
  `[checks rejected]` log line now shows exactly what was dropped.
- Data isolation test fixture updated for the new fields. Added a check that User B calling `lessons.ensure`
  on User A's pillar does nothing, so B can't make the app spend A's tokens.

## Verification

- Uploaded the memory test PDF with no subject. The concept model ordered pillars *Working memory → Encoding →
  Forgetting & spacing → Retrieval → Interleaving* (prerequisites first, not the document's order).
- Pillar 1 rendered a 5-step flow visual, 4 takeaways, a common trap ("7 ± 2"), and 2 sourced examples
  (journalofcognition.org, pmc.ncbi.nlm.nih.gov). Pillar 2 chose a comparison table (shallow vs deep).
- Opening pillar 2 showed "Building this lesson…" with its sub-ideas while pillar 3 prefetched.
- `npm test`: 6 tests pass (3 new rule tests in `convex/lessonRules.test.ts`). Lint shows 0 errors, and the build passes.
