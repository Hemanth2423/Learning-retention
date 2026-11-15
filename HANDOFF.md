# Handoff

Update at the end of every session. Keep only the latest state, since git keeps the history.

**Last updated:** 2026-11-14 · **Branch:** `feat/reading-experience` (docs are on `docs/project-setup`; no merges until Hemanth says so)

## Last verified state

- **App:** main @ `14a43fe` (placement check merged). Live at https://recall-psi-five.vercel.app
- **Tests:** `npm test` → 36 tests in 11 files pass (2026-11-06)
- **Lint:** 0 errors, 42 warnings (known debt, mostly unused variables)
- **Docs:** new setup in place (PRODUCT, ARCHITECTURE, AGENTS, CLAUDE, decisions/, tasks/, LEARNINGS). Old plans are in `docs/archive/`
- **Research (local, gitignored):** `research/competitive-teardown/COMPANION.md` + 23 figures from `Ingrain App.pdf`

## Unresolved problems

- **Non-goals and the success measure are still open** in PRODUCT.md. Core outcome and persona are written.
- **Architecture is proposed, not built.** New tables and `pdfjs-dist` are approved. **Slices 1 (upload), 2 (reader + Contents), 3 (highlights + comments) 4a (left overlay + resizable right panel) 4b (reflections with rich-text notes), 5 (chat) and 6 (Test tab + placeholder page) are built and browser-checked. All of Feature 1 is built.** Slice 5 (chat, **Ask AI**, **Validate**) is built and was tested with a free Gemini model (`LLM_PROVIDER=gemini` is set on the dev deployment, key in the gitignored `.env.local`). **DeepSeek is untested.** **Ask AI** in the selection menu is wired but hidden until chat (slice 5). `documents` and `chunks` tables exist on the dev deployment.
- **Tests run twice from the main checkout.** Vitest also picks up copies in `.claude/worktrees/`. Fix: exclude `.claude/**` in `vitest.config.mts`.
- **Legacy code (courses, lessons, reviews, gamification) is untouched** until a feature replaces it.
- **Research lives only where it was created** (gitignored). Master copy is in the main checkout. 5 ambiguities are listed in companion §11.

## Next action

1. **Hemanth:** review all of Feature 1 (run `npm run dev`, open `/read`), and share a real book PDF with a table of contents.
2. **Then:** review Feature 1 end to end with a real book, and say whether to open a PR (nothing is merged). Then run a few chat calls on DeepSeek (unset `LLM_PROVIDER`) to check real answer quality and cost.
