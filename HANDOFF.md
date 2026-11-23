# Handoff

Keep under 40 lines and only the latest state. Git keeps history.

**Updated:** 2026-11-23 · **Branch:** `feat/concept-check` (on `feat/folders`, `feat/feature-3-rest`, PR #82) · Demo Dec 2

## Verified state
- Features 1–2 are on `main`. Feature 3 (sources, Notebook) and 4 (folders) are built and committed locally.
- 261 tests pass, lint has 0 errors and 22 known warnings.
- AI default is Groq (ADR 011). `DEEPSEEK_API_KEY` is on dev, used only by the spike. Rotate that key before anything public.

## Open problems
- **Playlists are blocked:** Google returns 403 `ACCESS_DENIED` for the dev YouTube key. Hemanth set this aside. Needs a key from a personal Google project (no organization). Usage is capped by ADR 018.
- **Legacy code** (old course routes and tables) is still live. Don't read or change it unless asked.
- Repo is still public. Non-goals and the success measure are open in PRODUCT.md.

## Next action
1. **Concept check V1 is on `feat/concept-check`.** Verified on a real PDF: generate, answer, resume, finish, standing, phone width. Spend: at most $0.274 of the $0.30 test cap. **Get a new cap before more paid test runs.**
2. Known quality gaps are in [spike-results.md](tasks/feature-5-concept-check/spike-results.md): rerun the article, add hard questions for essays, test a narrative, then Hemanth and a teammate score 20 questions each.
3. Not built: vision questions and tight figure crops. Production needs `DEEPSEEK_API_KEY`, or it uses Groq.
4. Notion fixes are uncommitted on `fix/notion-export-ux` in their own session.

## Waiting, only when Hemanth asks
- Merge #82, deploy, rebase `feat/feature-3-rest`, open its PR, then the folders PR.
- After deploying: run `npx convex run notebook:migrateReflections` until it returns 0.
- Tell teammates `convex/exportRules.ts` is the shared export builder.
- Merge #73, make the repo private, revert #73 after Dec 2.
