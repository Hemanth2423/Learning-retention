# Slice 0: Quality spike results
**Date:** 2026-11-23 · **Result: V1 is built; the human quality gate has not been run.**

## What ran
DeepSeek V4 Pro with thinking off, through a temporary internal function on dev (removed). No schema or app code changed. Groq was the fallback and wasn't needed.

| Chapter type | Ideas | Questions | Time | Tokens in / out | Cost, at most |
|---|---|---|---|---|---|
| Technical book chapter | 5 | 15 | 56 s | 6,575 / 4,504 | $0.027 |
| Short article | 4 | 12 | 38 s | 3,938 / 3,085 | $0.017 |
| Slides | 5 | 15 | 45 s | 3,837 / 3,483 | $0.019 |
| Argument essay (23 of 54 pages) | 5 | 15 | 55 s | 7,015 / 4,013 | $0.025 |

**Spend for this table: at most $0.165**, at peak prices. That includes $0.077 on two failed attempts: thinking used a whole 9,000-token limit, and one verbose reply was cut off. An earlier Groq attempt returned only 4 of 15 questions.

## Findings
1. **DeepSeek can produce a full batch** in one call for about $0.02–0.03.
2. **Serious flaw: the correct answer is the longest option in 46 of 57 questions (81%).** Chance is 25%. A reader could score well without reading. A prompt instruction didn't fix it (36 of 42 after the change). **This needs a code rule.**
3. **The quote check works:** 55 of 57 quotes were found on the cited page. The other 2 would be withheld.
4. **Thinking must be off, or tightly bounded.** With it on, the model returned no questions.
5. **30 seconds isn't realistic.** Calls took 38–56 s, so generation needs a progress state or must run in the background.
6. **Quality varies by source (first read, not a score).** The technical chapter was strongest. Slides drifted into figures and recall labelled as Apply. Life-choice scenarios in the essay may lack one defensible answer. A course-description article yields thin ideas.
7. **Some wrong options are too easy**, such as "Money, fame, and power".
8. **Still missing:** a true narrative source.

## Round 2: length fix and audit
**Total spend after round 2: at most $0.191 of the $0.20 cap.** Testing stopped there.

| Length fix on the technical chapter | Correct answer is longest |
|---|---|
| Original prompt | 10 of 15 |
| Stricter prompt, one call ($0.023) | 8 of 12 |
| Plus repair of wrong options only ($0.003) | 6 of 12 |
| Plus code rule dropping answers over 1.15× the longest wrong option | **3 of 9** kept questions |

**The combined fix works directionally, on one chapter only.** It discards questions, so the batch must ask for spares. The correct answer is never edited.

### First-pass audit (54 questions, by Claude, not a human score)
| Measure | Result | Goal |
|---|---|---|
| One defensible, supported answer | about 50 of 54 (**93%**) | 95% |
| Matches intended mode | 34 of 54 (**63%**) | 85% |
| Remember | 15 of 18 | |
| Understand | 11 of 18; others are recall phrased as "why" | |
| Apply | **8 of 18**; others restate the source in a scenario | |
| Clearly hard questions | **2 of 54** | A real mix |
| Noticeably easy wrong options | about 14 of 54 | Few |

**Answer: difficulty is not yet varied.** The set skews easy, and Analyze isn't in the starter batch. True difficulty also needs reader data, so this is a judgment until first-attempt results exist.

## Round 3: built pipeline (prompt v6)
**Total for this round: at most $0.274 of the new $0.30 cap.** Hemanth approved building before the human gate.

| Source | Valid of written | Served | Mix (core/stretch/hard) | Cost, at most |
|---|---|---|---|---|
| Technical | 13 of 15 | 11 | 3 / 4 / 4 | $0.034 |
| Technical, harder batch | 15 of 16 | 15 | 3 / 6 / 6 | $0.030 |
| Slides | 13 of 15 | 11 | 4 / 4 / 3 | $0.031 |
| Article (before repair fix) | 13 of 15 | **4** | 2 / 1 / 1 | $0.032 |
| Argument (after repair fix) | 13 of 15 | **6** | 4 / 2 / 0 | $0.037 |
| Real PDF through the app | 9 of 14 | 8 | not recorded | $0.017 |

**Known gaps:** article not rerun after the repair fix; essay has no hard questions; a true narrative source wasn't tested because the transcript had no stored text; the blind check marked most technical questions guessable, so it only ranks them. Page-level figures are shown, not tight crops. Vision questions are not built.

## Spec changes needed
- **One DeepSeek V4 Pro call per batch,** thinking off, Groq fallback on rate limits. Add a small repair call only when options fail the balance check.
- **Option balance:** the 1.15× rule per question, and the correct answer longest in at most 40% of a batch.
- **Difficulty targets:** each batch mixes core, stretch and hard questions, set by how close the wrong options are and how many reasoning steps are needed.
- **Apply rule:** the answer can't be found by matching the source's wording.
- Block figure trivia and value judgments presented as one right answer.
- Replace "ideas within 30 s" with a visible progress state and a 90-second limit.
- Book visuals: see [Part 6](6-visuals.md).

## Gate
| Measure | Target | Status |
|---|---|---|
| Source-supported, one defensible answer | 95% | **Not met on first pass (93%)** |
| Matches intended mode | 85% | **Not met on first pass (63%)** |
| Varied difficulty | Real mix | **Not met** |
| Answer-length cue | Removed | **Improved, needs a 4-chapter retest** |
| Human and teammate scoring | Done | Not started; wait for the improved set |
