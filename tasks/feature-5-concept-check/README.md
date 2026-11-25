# Feature 5: Concept check
**Status:** V1 built on `feat/concept-check`; human quality scoring still pending · **PR:** none
**Inputs:** mockup 007 (local), research F10 and T1–T3 (local), [PRODUCT.md](../../PRODUCT.md), current test code, [external review](5-review-response.md).

## The problem
A chapter test says "4 of 5". It can't show which ideas a reader knows, whether they can use them, or what to do next. It is also a one-time event, so it does little for memory a week later.

## The V1 promise
> **Find which key ideas you can remember, understand and use in new scenarios, then revisit the ones that need practice.**

After a few short sessions, a reader can say:

> "I've shown reliable recall for 3 of 4 key ideas. I'm still practicing application for Craving and Reward. My next check is Thursday."

**What V1 claims:** evidence from selected-response questions on the chapter's text. **What it doesn't claim:** certified mastery, that everything in a chapter was tested, or skill at producing original work.

## The product in one view
| Part | Decision |
|---|---|
| **Unit of progress** | A key **idea** with a testable learning objective (1–5 per chapter) |
| **Practice modes** | **Remember, Understand, Apply, Analyze**. All available, none locked |
| **Session** | Target 8 questions, about 6 minutes. Shorter when useful questions run out |
| **Signal** | Sure / Think so / Guessing, before each result |
| **Progress** | Solid, Shaky, Needs practice or Not checked, with evidence counts and last-checked date |
| **Return** | Suggested next check. Due items come first. No reminders in V1 |
| **Question bank** | Finite, 10 per idea, generated in up to 3 batches |
| **Grading** | Server-side, no AI per answer |

## Key decisions
| # | Decision | Rejected | Why | Part |
|---|---|---|---|---|
| 1 | **Modes guide, the scheduler recommends** | Locks or proof gates | Higher-order and mixed practice helped higher-order results; fact practice alone didn't | [2](2-learning-rules.md) |
| 2 | **Report evidence counts, not percentages** | "Recall 80%" | A few questions can't estimate what share of a chapter is known | [1](1-experience.md) |
| 3 | **Solid needs spaced success since the last miss** | Accuracy threshold | Separates lasting performance from one good sitting | [2](2-learning-rules.md) |
| 4 | **Separate practice, retention and transfer** | One "counted" flag | A repeated scenario can show memory, but never new-situation use | [2](2-learning-rules.md) |
| 5 | **A correct guess is weak evidence** | Treat as proof, or as nothing | It asks for confirmation without penalising honesty | [2](2-learning-rules.md) |
| 6 | **Spacing is 20 elapsed hours** | Calendar days | No midnight or time-zone loopholes | [2](2-learning-rules.md) |
| 7 | **Multiple choice only in V1** | AI-graded writing | Consistent grading at no per-answer cost. Question quality remains the fairness risk | [2](2-learning-rules.md) |
| 8 | **Finite bank, honest limits** | Endless generated practice | Predictable cost. Replenishing waits for evidence of demand | [3](3-architecture.md) |
| 9 | **Every question quotes its source** | Trust the model's page number | Code can verify the quote exists in the chapter | [3](3-architecture.md) |
| 10 | **Mastery is computed from answer events** | Stored scores | Rules can change without migrating data | [3](3-architecture.md) |
| 11 | **Grid first, graph not promised** | Concept graph in V1 | AI-made links need their own quality work | [1](1-experience.md) |
| 12 | **No Lexile** | Show a reading level | Licensed, and doesn't measure learning | [2](2-learning-rules.md) |

## Scope
- **In V1:** PDF, EPUB, Word, PowerPoint and article chapters with text. Conceptual learning from text.
- **Out of V1:** written answers, concept graph, book-wide trends, reminders, DOK 4 projects, reading-level adaptation, videos without transcripts, prerequisite maps.

## Your decisions before build
1. **Allow in-app spaced return.** This changes a non-goal in PRODUCT.md. **Recommended: yes.**
2. **Keep the bank finite in V1.** **Recommended: yes.**
3. **Run the quality spike first** (about 4 paid AI calls, no schema change). Tables get approved only after it passes. **Recommended: yes.**
4. **Demo scope for Dec 2:** ship through slice 3 and keep today's test as the fallback. **Recommended: yes.**

## Read next
[1. Experience](1-experience.md) · [2. Learning rules](2-learning-rules.md) · [3. Architecture](3-architecture.md) · [4. Build plan](4-build-plan.md) · [5. Review response](5-review-response.md) · [6. Book visuals](6-visuals.md) · [Spike results](spike-results.md)
