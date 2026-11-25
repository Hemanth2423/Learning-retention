# Part 4: Build plan and verification
**One slice per session.** Each reads only the README, the listed part and listed files, then stops for review.

| # | Slice | Result | Read | Gate |
|---|---|---|---|---|
| 0 | **Quality spike** | Real questions reviewed; no app changes | Part 3 | Passes quality gate |
| 1 | **Rule simulation** | `conceptRules.ts` proven with simulated readers | Part 2 | Approve tables |
| 2 | **Vertical slice** | Generate → answer → feedback → resume | Parts 1, 3 | Browser check |
| 3 | **Standing** | Evidence grid and plain language | Part 1 | Comprehension check |
| — | **Dec 2 demo line** | Today's test stays as fallback | | |
| 4 | **Return loop** | Due items, misses first | Part 2 | Time simulation |
| 5 | **Deepen + Stretch** | Full bank | Part 3 | Cost measured |
| 6 | **Path + polish** | Path state, notes, phone | Part 1 | Full journey |

## Acceptance criteria
**0. Spike**
- [ ] About 60 questions across 4 chapter types (technical, narrative, argument, short article), reported by mode.
- [ ] At least **95%** source-supported with one defensible answer, and **85%** match the intended mode.
- [ ] A teammate independently rates 20. Every systematic failure is inspected.
- [ ] Tokens are measured per batch.

**1. Simulation**
- [ ] Both Part 2 examples pass as tests.
- [ ] Simulated readers: strong, average, all wrong, all guessing, crammer, returner.
- [ ] Covers 1, 2 and 5 ideas; partial banks; 19.9 vs 20 hours; time-zone change; invalidated questions; repeated scenarios; exhausted banks.

**2. Vertical slice**
- [ ] A real chapter returns meaningful ideas within 30 s. Double-click makes one AI call.
- [ ] Each question shows its mode, reveals its idea after answering, and links a verified source.
- [ ] Reload after answering restores the feedback. Duplicate submission changes nothing.
- [ ] Keys never reach the browser before submission. Report removes a question.

**3. Standing**
- [ ] Not checked never looks like failure. No percentages appear.
- [ ] **3 people can explain the states, name one next action, and say untested doesn't mean a gap.**

**4. Return loop**
- [ ] A confident error returns first. Same-day practice can't reach Solid.
- [ ] One miss doesn't reset other cells.

**5. Deepen + Stretch**
- [ ] No repeated questions. Caps hold under failures. A repeated scenario never counts as transfer.

**6. Path + polish**
- [ ] Path shows the correct state in priority order; old scores stay separate.
- [ ] Deleting a book removes all concept data. Works at 375 px and by keyboard.

## Test plan
- **Unit:** every rule. **Backend:** ownership, no leaked keys, idempotency, races, stale saves, purge.
- **Time:** fixed clocks, never real waiting. **Browser:** one real PDF per UI slice.
- **Token rule:** targeted tests during a slice, the full suite once before commit.

## How we'll know it works
| Question | Metric | Type | Early target |
|---|---|---|---|
| Do readers return? | First-session completers with another session within 7 days | Engagement | Over 30% |
| Do they use ideas in new situations? | First-attempt pass rate on unseen scenarios, 7+ days after first practice | **Transfer** | Baseline first |
| Does memory hold? | Pass rate on delayed repeats | Retention (familiarity inflates it) | Baseline first |
| Is it efficient? | Sessions to reach Solid at Remember and Apply | Efficiency | Baseline first |
| Do corrections last? | Confident errors repeated at the next check | Correction | Falling |
| Are questions trustworthy? | Confirmed invalid questions per 100 served | Quality | Under 5 |

**Before claiming it improves learning:** compare with today's chapter test on a delayed assessment of unseen questions. This is a post-V1 pilot.

**Before a public beta:** review 100–150 questions, with 95% validity and 90% mode agreement.

## Definition of done
**Engineering:** slice criteria, `npm test`, lint, full browser journey, HANDOFF updated.
**Product:** users can explain what progress states mean, identify one next action, and understand that untested content isn't a gap. Nothing merges until Hemanth says so.
