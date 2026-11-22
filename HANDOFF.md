# Handoff

Update at the end of every session. Keep only the latest state, since git keeps the history.

**Last updated:** 2026-11-22 · **Working branch:** `feat/feature-3-rest` (slices 2–6, stacked on #82's `api/article-youtube-links`) · **Default:** `main` (protected: PR + 1 teammate approval + CI `test`) · CodeMates team assignment until Dec 2

## Last verified state

- **App:** main @ `14a43fe` (placement check merged). Live at https://recall-psi-five.vercel.app
- **Tests:** `npm test` → 163 tests in 31 files pass; lint 0 errors, 22 warnings (2026-11-17)
- **Feature 2 slices 1–5 built and browser-checked** on `feat/library-and-path` (local commits, not pushed; slice 5 not committed yet): Home, chapter path, reader layout, Test yourself, XP. Details in the task file's status log
- **AI:** Groq (`openai/gpt-oss-120b`) is the default (ADR 011); `GROQ_API_KEY` is in the gitignored `.env.local` and on the dev deployment. The key was pasted in chat, so rotate it before anything public
- **Lint:** 0 errors, 42 warnings (known debt, mostly unused variables)
- **Docs:** new setup in place (PRODUCT, ARCHITECTURE, AGENTS, CLAUDE, decisions/, tasks/, LEARNINGS). Old plans are in `docs/archive/`
- **Research (local, gitignored):** `research/competitive-teardown/COMPANION.md` + 23 figures from `Ingrain App.pdf`

## Unresolved problems

- **Non-goals and the success measure are still open** in PRODUCT.md. Core outcome and persona are written.
- **Architecture is proposed, not built.** New tables and `pdfjs-dist` are approved. **Slices 1 (upload), 2 (reader + Contents), 3 (highlights + comments) 4a (left overlay + resizable right panel) 4b (reflections with rich-text notes), 5 (chat) and 6 (Test tab + placeholder page) are built and browser-checked. All of Feature 1 is built, plus UX audit round 1 (icon selection menu, floating page/zoom pill, bottom-right chapter dock).** Slice 5 (chat, **Ask AI**, **Validate**) is built and was tested with a free Gemini model (`LLM_PROVIDER=gemini` is set on the dev deployment, key in the gitignored `.env.local`). **DeepSeek is untested.** **Ask AI** in the selection menu is wired but hidden until chat (slice 5). `documents` and `chunks` tables exist on the dev deployment.
- **Tests run twice from the main checkout.** Vitest also picks up copies in `.claude/worktrees/`. Fix: exclude `.claude/**` in `vitest.config.mts`.
- **Legacy code (courses, lessons, reviews, gamification) is untouched** until a feature replaces it.
- **Research lives only where it was created** (gitignored). Master copy is in the main checkout. 5 ambiguities are listed in companion §11.

## Team setup (CodeMates assignment, demo Dec 2)

- **Team:** @Hemanth2423 (owner; articles via Firecrawl + YouTube), @abbystern (Notion export), @EEBarr14 (Google Docs export). Plan: [TEAM-PLAN.md](TEAM-PLAN.md).
- **CI:** `.github/workflows/ci.yml` (from #71) runs `npm test` + `npm run lint` on every PR. `main` requires a PR, 1 approval and the `test` check, for admins too.
- **Open:** the repo is still **public** (the assignment wants private; branch protection on a private repo needs GitHub Pro / Education). AGENTS.md temporary team rules are #73 (approved, needs "Update branch", then merge). Revert #73 after the demo.
- **Deploys:** Vercel isn't connected to GitHub; production is deployed by hand (`npx convex deploy`, then `vercel deploy --prod` from a clean export of `main`). Teammates' features must be live by Dec 2.

## Next action

0. **Folders + UX round** are on `feat/folders` (stacked on `feat/feature-3-rest`), committed, not pushed: `tasks/feature-4-folders.md`, ADRs 016–017. **To switch playlists on:** `YOUTUBE_API_KEY` is not on the dev deployment yet (app reports it missing, 2026-11-22); run `npx convex env set YOUTUBE_API_KEY <key>` from the repo, then test one real playlist. Usage is capped in code at 1,000 units/day (ADR 018). Open its PR after the Feature 3 PR. Mockups 006–008 are in the gitignored `.context/compound-engineering/ce-prototype/2026-11-21-folders-and-practice/`; the practice ladder (007) is parked.

1. **Merge PR #82** (Feature 3 spec + slice 1) after a teammate approves, deploy production, then rebase `feat/feature-3-rest` onto `main` and open its PR (slices 2–6, all committed locally, not pushed).
2. **After deploying slice 5 anywhere:** run `npx convex run notebook:migrateReflections` until it returns 0 (moves old chapter notes into the Notebook; done on dev: 7 notes).
3. **Tell @abbystern and @EEBarr14:** `convex/exportRules.ts` (buildExport + toMarkdown) is the shared builder; their Send buttons go in the Export sheet ("Soon" rows today).
4. **Hemanth to review in the browser:** Notebook compose flow, EPUB with a real book (only generated samples were tried), PDF covers on real books. Download and Print in the Export sheet weren't clicked (builder is tested).
5. Merge #73; make the repo private; revert #73 after Dec 2. Copy prototype 005 + `decisions.md` from worktree `learning-retention-d5b089/.context/` to the main checkout.

**State (2026-11-20):** `feat/feature-3-rest` @ slice 6; 224 tests pass, lint 0 errors / 22 warnings, build passes. New deps: `fflate`, `mammoth`. Schema: covers, notes, savedQuestions, highlight ranges, new source types (ADRs 013–015).
