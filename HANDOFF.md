# Handoff

Keep under 40 lines and only the latest state. Git keeps history.

**Updated:** 2026-11-23 · **Branch:** `feat/concept-check` (PR #89, on `feat/ux-enhancements`, PR #88) · Demo Dec 2

## Verified state
- Features 1–2 are on `main`. Feature 3 (sources, Notebook) and 4 (folders) are built and committed locally.
- 261 tests pass, lint has 0 errors and 22 known warnings.
- AI default is Groq (ADR 011). `DEEPSEEK_API_KEY` is on dev, used only by the spike. Rotate that key before anything public.

## Open problems
- **Playlists are blocked:** Google returns 403 `ACCESS_DENIED` for the dev YouTube key. Hemanth set this aside. Needs a key from a personal Google project (no organization). Usage is capped by ADR 018.
- **Legacy code** (old course routes and tables) is still live. Don't read or change it unless asked.
- Repo is still public. Non-goals and the success measure are open in PRODUCT.md.

## Next action
1. **Hemanth tests at http://localhost:3000** (branch `feat/concept-check`, dev backend).
2. **Open PRs, not merged:** [#88 UX enhancements](https://github.com/Hemanth2423/Learning-retention/pull/88) into `main`; [#89 Concept check](https://github.com/Hemanth2423/Learning-retention/pull/89) stacked on it. Retarget #89 to `main` after #88 merges.
3. Each PR still needs an issue (`closes #N`), a screenshot and a teammate approval. #88 includes #82.
4. Notion on this dev backend isn't configured. Its fixes were checked on the separate test deployment; reading from `notes` is covered by tests only.
5. Concept quality gaps are in [spike-results.md](tasks/feature-5-concept-check/spike-results.md). Test spend is $0.274 of $0.30, so **get a new cap before more paid test runs.**

## Waiting, only when Hemanth asks
- Merge #82, deploy, rebase `feat/feature-3-rest`, open its PR, then the folders PR.
- After deploying: run `npx convex run notebook:migrateReflections` until it returns 0.
- Tell teammates `convex/exportRules.ts` is the shared export builder.
- Merge #73, make the repo private, revert #73 after Dec 2.
