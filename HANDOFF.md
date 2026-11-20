# Handoff

Update at the end of every session. Keep only the latest state, since git keeps the history.

**Last updated:** 2026-11-19 · **Working branch:** `feat/feature-3-rest` (slices 2–6, stacked on #82's `api/article-youtube-links`) · **Default:** `main` (protected: PR + 1 teammate approval + CI `test`) · CodeMates team assignment until Dec 2

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

1. **Merge PR #82** (Feature 3 spec + slice 1) after a teammate approves, then deploy production (`npx convex deploy`, then `vercel deploy --prod` from a clean export of `main`). Then rebase `feat/feature-3-rest` onto `main`.
2. **Slice 2 (polish) is built, not committed** on `feat/feature-3-rest`: tests 178 pass, lint 0 errors, build passes, browser-checked. Hemanth reviews it, then commit.
3. **Next: slice 3** (library tiles and covers) on the same branch. Then 4 (export downloads), 5 (Notebook, after the Notion/Docs PRs merge), 6 (EPUB/Word/PowerPoint + bulk add). Spec: `tasks/feature-3-sources-and-notebook.md`. Prototype 005 + `decisions.md` live only in the worktree `.claude/worktrees/learning-retention-d5b089/.context/…`; copy them to the main checkout before that worktree is cleaned up.
4. Merge #73 (temporary AGENTS.md team rules); make the repo private; revert #73 after Dec 2.
