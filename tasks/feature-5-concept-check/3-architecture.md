# Part 3: Architecture
**Approval:** four new tables, requested **after** the quality spike and rule simulation pass. No existing table changes.

## Flow
```
Test yourself → concepts.get → (no check) concepts.prepare
   claim batch → chapter text → llm.ts → clean + verify quotes → save
→ concepts.start → buildSession → saved session
→ concepts.answer → grade on server → append event → XP
→ finish → compute standing → store next check date
```

## Data
**`conceptChecks`**, one per reader and chapter. Indexes `by_document_chapter`, `by_user`.
`userId`, `documentId`, `chapterKey`, `ideas[]` (`id`, `name`, `objective`, `page`), `batchesDone`, `generatingBatch?`, `generatingAt?`, `failedTries`, `failedDay?`, `sourceHash`, `coverage` (`pagesUsed`, `pagesTotal`), `solidAwarded[]`, `nextCheckAt?`.

**`conceptQuestions`**, the bank. Index `by_check_mode`.
`checkId`, `ideaId`, `mode`, `batch`, `question`, `options`, `answer`, `explanation`, `whyWrong`, `page`, `excerpt`, `active`, `reportReason?`, `promptVersion`, `model`.

**`conceptSessions`**, one per sitting. Index `by_check_finished`.
`userId`, `checkId`, `items[]` (`questionId`, `optionOrder`, `reason`), `position`, `finished`, `startedAt`.

**`conceptAnswers`**, append-only events. Indexes `by_check_at`, `by_session_question`.
`userId`, `checkId`, `sessionId`, `questionId`, `ideaId`, `mode`, `option`, `confidence`, `correct`, `at` (server time).

### Why this shape
| Choice | Why |
|---|---|
| Separate questions table | Items are fetched, reported and excluded individually |
| Append-only answers, computed status | One source of truth. Excluding a bad question corrects status automatically |
| Evidence kind isn't stored | It's derived from exposure history, so rules can evolve |
| Option ID = its stored index | Options never change after saving. `optionOrder` shuffles display only |
| `page` as locator | Text sources already use `{kind:"text", page}` for blocks, so EPUB, Word, slides and articles work |
| `solidAwarded` on the check | **Today's `learnerStats.awarded` array grows forever.** Per-question keys would hit Convex's array limit. Concept XP stays idempotent inside bounded per-chapter data |
| Full history, no 500 cap | Status and XP need it. If a chapter ever gets too large, add a rebuildable projection then |

## Backend
| File | Holds |
|---|---|
| `convex/conceptRules.ts` | **Pure:** evidence, status, builder, schedule, summaries, XP, cleaning, quote check |
| `convex/conceptPrompts.ts` | Batch prompts, with `PROMPT_VERSION` |
| `convex/concepts.ts` | Public functions, internal claim and save |

| Function | Contract |
|---|---|
| `get` | Standing and ideas. Never returns keys for unanswered questions |
| `prepare` | Generates what's missing. Safe to call twice |
| `start` | Returns the unfinished session or builds one |
| `current` | Current question, plus saved feedback if already answered |
| `answer` | Only the current session item and a valid option. A duplicate returns the saved result |
| `next` | Advances the session; finishing computes the next check date |
| `report` | Marks a question inactive for this reader |
| `saveMisses` | Saves corrected idea and source to `savedQuestions` |

Convex transactions serialise racing tabs. All public functions use `requireUser` and ownership checks. `documents.purge` adds all four tables.

## AI generation
| Batch | When | Target per idea | Max at 5 ideas |
|---|---|---|---|
| **1 Starter** | First open | Ideas + Remember, Understand, Apply | 15 |
| **2 Deepen** | Bank can't fill the next session | Remember, Understand, Apply, Analyze | 20 |
| **3 Stretch** | Fresh Apply or Analyze runs low | Apply, 2 Analyze | 15 |

**Final bank per idea:** 2 Remember, 2 Understand, 3 Apply, 3 Analyze.

- **Requests are by deficit.** Each batch asks for target minus active questions, so it repairs partial results and reported items.
- **Cap:** 3 successful batches per chapter, and 2 failed tries per chapter per day. No automatic retries.
- **Partial success:** keep valid questions. The batch counts if every idea has at least one valid question.
- **Cost:** about 35K tokens for a fully used chapter (estimate, measured in the spike). A refunded daily allowance doesn't refund provider cost, which is why failures are capped.
- **Input fix needed:** `summaryPassages` keeps at least 300 characters per page, so chapters over 100 pages exceed the 30,000 cap. Concept checks need a hard cap and accurate coverage.
- **Stale saves are rejected** if the document is gone or `sourceHash` changed. Locks expire after 2 minutes.

## Question quality
| Layer | Checks |
|---|---|
| **Code (every question)** | Valid idea and mode; four unique options; one key; no catch-alls; **excerpt found in the cited page**; length-cue check; idea name not in the stem where it reveals the answer |
| **Prompt** | Testable objective, plausible misconceptions as distractors, mode rubric. Source text is data, never instructions |
| **Human (spike)** | Supported, one defensible answer, no clues, plausible distractors, correct mode, source supports explanation |
| **Reader** | Report a problem |

## Risks
| Risk | Mitigation |
|---|---|
| Flawed answer key | Quote check, spike gate, reporting, exclusion |
| Wrong mode label | Scored by mode in the spike |
| Prompt injection from a document | Text treated as data; strict output validation; no tools |
| Truncated source | Hard cap and visible coverage |
| Model can't write 15–20 good questions | Spike; smaller batches if needed |
| Status logic too complex | Simulation before any table exists |
