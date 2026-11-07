# bCourses submission: Ingrain

| # | bCourses item | What to paste / upload | Status |
|---|---|---|---|
| 1 | GitHub repo URL | https://github.com/Hemanth2423/Learning-retention | Needs to be public or have the instructor and GSI added |
| 2 | Live app URL | https://recall-psi-five.vercel.app | Live |
| 3 | PLAN.md (with Plan vs. Reality) | https://github.com/Hemanth2423/Learning-retention/blob/main/PLAN.md | Done |
| 4 | Dashboard screenshot (own account, real data) | `Assignment/dashboard-screenshot.png` | Take after adding 5+ real courses |
| 5 | Reflection answers with evidence | `Assignment/Reflection.docx` (same text: [Reflection.md](Reflection.md)) | Done |

## Grading checklist

- **Spine features (live URL):** sign up/login, data model (users, courses, topics, answers, stars), CRUD with an "are you sure?" delete, validation, stars plus a Starred view, Find (search, filter, sort), dashboard (chart plus 4 stats).
- **3+ custom features:** concept model with visual lessons, the concept map, adaptive checks, and the progress report with next steps.
- **5+ real entries:** upload at least 5 real PDFs on the live site under your own account.
- **Docs:** [PLAN.md](../PLAN.md) (merged first, in [PR #2](https://github.com/Hemanth2423/Learning-retention/pull/2)), [schema.md](../schema.md), [README.md](../README.md).
- **Feature loop:** [24 merged PRs](https://github.com/Hemanth2423/Learning-retention/pulls?q=is%3Apr+is%3Amerged), each with a linked issue (`closes #N`), its own branch, and a prompt log in [prompts/](../prompts).
- **Tests:** both pass (`npm test`).
  - Data isolation: [PR #26](https://github.com/Hemanth2423/Learning-retention/pull/26)
  - Dashboard stat: [PR #28](https://github.com/Hemanth2423/Learning-retention/pull/28), updated in [PR #44](https://github.com/Hemanth2423/Learning-retention/pull/44)
  - Red/green screenshots: [test-evidence/](test-evidence)
  - Explanations and "what would break it": [prompts/test-data-isolation.md](../prompts/test-data-isolation.md), [prompts/test-dashboard.md](../prompts/test-dashboard.md)
- **Reflection:** [Reflection.md](Reflection.md)

## Demo script (5 minutes)

1. **Live sign-up (30s):** open the live URL and create a brand-new account in front of the class.
2. **Your account (1 min):** log out, log in as yourself, open Courses (5+ real courses), then the Dashboard.
3. **One course (2 min):**
   - Expand one branch of the concept map with (+).
   - Open pillar 1 and walk through the visual, the takeaways and the common trap.
   - Answer the check question. Get one wrong on purpose to show the easier question and the trickier one.
4. **Audience choice (1 min):** let the class pick a pillar to star, or a word to search in Find. Then show Starred.
5. **Q&A (1 min).**
