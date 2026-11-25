# Part 2: Learning rules and evidence

## Four practice modes
Bloom and DOK are separate design lenses. This is a **typical alignment, and each question is reviewed individually.** The modes are not a validated staircase.

| Mode | Required task | Bloom | Typical DOK |
|---|---|---|---|
| **Remember** | Identify a central fact, relationship or definition, without trivial wording cues | Remember | 1 |
| **Understand** | Distinguish an accurate mechanism or interpretation from plausible misconceptions | Understand | 2 |
| **Apply** | Use the concept in a materially new case | Apply | 2–3 |
| **Analyze** | Weigh evidence or separate competing explanations under stated constraints | Analyze, Evaluate | 3 |

**Why "Remember" and "Understand":** selecting an option is recognition, not free recall, and choosing an explanation isn't producing one. These names claim only what the format shows.

## Rules (pure code, all tested)
**1. Three kinds of attempt**
| Kind | Meaning | Affects |
|---|---|---|
| **Practice** | Every answer | Feedback, what returns next |
| **Retention evidence** | A delayed check: Remember/Understand after 20 hours, Apply/Analyze repeats after 14 days | Status |
| **Transfer evidence** | First sight of an Apply or Analyze scenario | Status |

**2. Evidence result.** **Pass:** correct, marked Sure or Think so. **Weak:** correct, marked Guessing. **Miss:** wrong.

**3. Status** (per idea and mode, from evidence in time order)
| Status | Rule |
|---|---|
| **Not checked** | No evidence |
| **Solid** | Since the last miss, at least 2 passes **20+ hours apart**. Apply/Analyze also need 2 different scenarios and at least 1 first-sight pass ever |
| **Needs practice** | The latest non-weak result is a miss, and the one before it isn't a pass |
| **Shaky** | Anything else |

**Example: Remember, Cue**
| When | Answer | Status |
|---|---|---|
| Mon 9:00 | Q1 wrong | Needs practice |
| Mon 9:02 | Q2 right, Guessing | Needs practice |
| Tue 20:00 | Q1 right, Sure | Shaky |
| Thu 18:00 | Q2 right, Think so | **Solid** |
| Next Mon | Q1 wrong | Shaky |

**Example: Apply, Cue**
| When | Answer | Status |
|---|---|---|
| Day 1, 9:00 | Scenario A right, Sure | Shaky |
| Day 1, 10:00 | Scenario B right, Sure | Shaky (not spaced) |
| Day 3 | Scenario C right, Think so | **Solid** |
| Day 20 | Repeat A wrong | Shaky |
| Day 22 | Repeat B right | Shaky |
| Day 24 | Repeat C right | **Solid** |

**4. No gates.** Every mode with a question is available. The scheduler only recommends.

**5. Session builder** (target 8)
1. **Due items,** confident errors first.
2. **Unchecked ideas,** so coverage grows.
3. **Fresh Apply or Analyze scenarios.**
4. **Maintenance** of the oldest Solid cells.
5. **Optional repeats,** treated as practice, only if the reader chooses Practice anyway.

Guards:
- **Max 3 questions per idea** per session, so one struggling idea can't take over.
- **At least 2 Apply or Analyze** when available.
- **First session:** one question per idea first, rotating modes, then fill. Partial coverage is expected: 5 ideas × 4 modes can't fit in 8 questions.
- **End early** rather than serve redundant questions.
- **Order:** due first, then easier to harder. Avoid the same idea twice in a row.

**6. Scheduling** (per idea and mode)
- A pass moves the cell to the next interval: 1, 3, 7, 21 days, then ×2.5.
- A miss resets **that cell only** to 1 day.
- Practice under 20 hours doesn't advance a due date. A miss can bring it forward.
- A due cell with no eligible question isn't shown as due.
- The chapter's date is its earliest due cell.

**7. XP.** **+2** the first time a question is right, **+5** the first time a cell reaches Solid. Max 40 per idea. Confidence never affects XP, so there's no reason to overstate certainty.

**8. Confidence never changes whether an answer is correct.** It influences how much confirmation we seek and what we recommend next.

## What the evidence supports, and what's our judgment
| Evidence supports | Our unvalidated choice |
|---|---|
| Practice testing can transfer to new situations, not uniformly ([Pan & Rickard 2018](https://sc-pan.github.io/pdf/PR_2018.pdf)) | Fresh-scenario rules, bank size |
| Higher-order and mixed quizzes aid higher-order performance ([Agarwal 2019](https://pdf.poojaagarwal.com/Agarwal_2018_JEdPsych.pdf)) | First-session mix, max 3 per idea |
| Successful retrieval across spaced sessions aids retention ([Rawson & Dunlosky 2022](https://journals.sagepub.com/doi/full/10.1177/09637214221100484)) | 2 passes, 20 hours, 1/3/7/21 schedule |
| Competitive wrong options can support retrieval ([Little & Bjork](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2017/01/LittleBjorkMC2014.pdf)) | Our distractor rubric |
| Corrective feedback reduces learning from wrong options ([summary](https://www.retrievalpractice.org/strategies/2018/multiple-choice)) | Feedback after every item |
| High-confidence errors respond to feedback but can return ([Butler, Fazio & Marsh 2011](https://link.springer.com/article/10.3758/s13423-011-0173-y)) | Confident errors return first |
| Interleaving helps, mostly in maths and category learning (Rohrer et al. 2015 †) | Mixing ideas in book chapters |

† Known citation, not re-read for this spec.

**These sources don't validate our exact thresholds.** All numbers are hypotheses and live in one constants block so they can be tuned. **Lexile** is licensed and describes text difficulty, so V1 leaves it out.
