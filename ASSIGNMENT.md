# Assignment H: Team App (the course rules)

The course brief this repo is built for. **Source:** [bCourses, MBA 296C, (H) Team App](https://bcourses.berkeley.edu/courses/1555569/assignments/9130764) (Berkeley login). This is a condensed version: if the two disagree, the source wins. **Due Wed Dec 2, before class (4pm).**

## The goal

- The group takes one member's solo app (Ingrain, owned by **@Hemanth2423**) and **each member adds one API-powered feature**.
- We work like a product team: someone else's codebase, **every change reviewed by a teammate before it reaches `main`**.
- **One grade for the whole group.** A teammate's unfinished feature is everyone's problem.

## The workflow (every change, no exceptions)

| Step | What to do |
|---|---|
| **1. Issue** | Open a GitHub Issue. For a feature, paste its user story from TEAM-PLAN.md. Assign it to yourself. |
| **2. Branch** | Branch from the **latest `main`**, named for the work (e.g. `api/notion-export`). |
| **3. Build** | Build on that branch. Save key prompts in `prompts/<feature>.md`. Start each session with "Read PLAN.md and TEAM-PLAN.md. Today I'm building ___." (In this repo the owner's plan is PRODUCT.md.) |
| **4. Pull request** | PR into `main`. Description: what changed, `closes #N`, a screenshot of it working. Mention any merge conflict you resolved. |
| **5. Review** | At least **1 teammate approval** (you can't approve your own). Fix what they find; push to the same branch. |
| **6. Merge** | Once approved **and CI is green**, the **author** merges. |
| **7. Deploy** | The live URL must stay current with `main`. |

- **Never commit or push to `main`.** Instructors check for this.
- **Pull `main` often.** Four people change one app.
- **A review** = Files changed → Review changes, with at least one specific comment, question or suggestion.
- **No secrets in git, ever.** The repo stays private.

## Per-member minimums

- **2 PRs authored and merged:** the onboarding PR (name in README's Team section) and your API feature **with its test in the same PR**.
- **2 reviews given**, each with a specific comment, on **2 different teammates'** PRs.

## The team spine (required)

1. **One different API per member.** At most one AI/LLM API in the whole group.
2. **Called from the server.** The browser never talks to the API directly.
3. **Saves something** to the database.
4. **Reviewed workflow:** no commits on `main`, a teammate approval on every PR, tests in CI.
5. **Live:** every feature works on the live URL by Dec 2.

OAuth APIs (Google, Spotify, etc.) are allowed but "hard mode": flag them in TEAM-PLAN.md and talk to the GSI.

## Tests

- **Each member writes 1 test for their own feature.** Test **your feature, not the API**: assume the API answered, then check what the app saves, calculates, shows or protects.
- Write it as **"Given ___, when ___, then ___."** Good spots: duplicates, edits after fetch, filters, totals.
- The PR description includes: a **plain-English explanation** (what the test sets up, does and checks) and **what would break it** (one real change that would make it fail).
- All tests run together in CI. **A PR that breaks someone else's test doesn't merge.**

## Required docs

- **TEAM-PLAN.md** (merged before any feature PR): pitch, who builds what, API cards, database changes, tests, done-when. At the end, add a **Plan vs. Reality** table. Don't rewrite the plan. Leave the owner's PLAN.md alone.
- **REFLECTION.md** (via PR): each member's 200–300 word API story with quoted prompts and a linked PR/commit; a group section on the two most important review comments and the hardest part of working in someone else's code. **No evidence = half credit at most.**

## Grading (100)

| Area | Pts | Full credit |
|---|---|---|
| API features | 35 | All work live, server-side, save to DB |
| Tests | 15 | CI on, nothing on `main`, every test passes and tests the feature, with explanation |
| Reviews | 10 | Every member: 2+ specific reviews on 2 teammates' PRs |
| Reflection | 30 | Every Q answered with evidence |
| TEAM-PLAN.md | 10 | Merged first, all 6 sections, honest Plan vs. Reality |

## Submission (one per group)

Private repo URL (with @joewadcan and @prakharj282 as collaborators, containing TEAM-PLAN.md and REFLECTION.md) and the live app URL.
