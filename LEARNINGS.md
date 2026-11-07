# Learnings

What building Ingrain V1 → V2 taught me (Nov 3–6, 2026). Format: **what happened → the lesson.** Add new ones at the bottom of a section.

## Scope

1. **Too aspirational.** I aimed at "solve learning retention" and let Claude burn tokens across ~30 PRs and 10+ features. → **One narrow user, one outcome, one feature at a time.** Breadth hides whether anything works.
2. **Extras before the core worked.** Stars, search, XP, achievements and a dashboard got built before the core loop was proven. → **Prove the core loop with a real user before adding motivation or polish.**
3. **Research came after the build.** LEARNING-SCIENCE.md was written after V1 shipped and forced a redesign. → **Understand the domain first, then plan features from it.**

## Specs

4. **My plan described screens, not outcomes.** "4–8 topics, 5-question quiz, 80% = mastered" got built exactly, and it taught nothing. → **Acceptance criteria describe what the user can do afterwards, with a concrete example of good.**
5. **Vague asks get filled in by the agent.** I asked for "a short test per chapter". The agent itself wrote "grounded in the SOURCE" into the prompt, and every bad question came from that. → **Read the prompts and decisions the agent writes, not just the result.**

## Verification

6. **I checked that it ran, not that it taught.** I scored 4/5, saw "Mastered" and moved on. → **Verify against the user outcome, with real content, end to end.**
7. **A 10-minute stranger test beat days of building.** Devi found the 3 biggest problems (upload, map, content) in one session. → **Watch a real user early and often, without helping.**
8. **I patched the wrong design.** Shuffling the answer order (PR #32) hid the real problem for a while. → **When a fix feels like a patch, stop and question the design.**

## Cost of mistakes

9. **A wrong core cascades.** The rewrite (PRs #40, #44) changed tables, deleted real courses, redid tests and evidence, and cost a day before the demo. → **Get the data model and pipeline right before building on them.**
10. **Better and cheaper can be the same move.** Reading the PDF once with a strong model, then building lessons on demand, improved quality *and* cut tokens. → **Design the token budget up front; it often improves the design.**

## Working with agents

11. **Prompts are suggestions; code is a guarantee.** The model kept breaking question rules until they lived in `questionRules.ts`. → **Anything that must always hold goes in code and gets a test.**
12. **Agents deviate quietly.** Placement moved to its own AI call. That was fine, but only because the agent flagged it. → **Require every deviation to be written in the task file and the PR.**
13. **Too many docs means no docs.** Two plans, a schema doc, a science doc and 30 prompt logs: too much to read at the start of a session. → **A few short files, each with one job and a clear "read it when".**
14. **Required fields are friction.** A mandatory "Subject" field stopped a new user cold. → **Default to optional and ask for less.**
