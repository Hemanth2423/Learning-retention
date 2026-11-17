# Handoff

Update at the end of every session. Keep only the latest state, since git keeps the history.

**Last updated:** 2026-11-17 · **Branch:** `feat/library-and-path` (from `feat/reading-experience`; that branch is deleted once this reaches main; no merges until Hemanth says so)

## Last verified state

- **App:** main @ `14a43fe` (placement check merged). Live at https://recall-psi-five.vercel.app
- **Tests:** `npm test` → 150 tests in 29 files pass; lint 0 errors, 22 warnings (2026-11-17)
- **Feature 2 slices 1–4 built and browser-checked** on `feat/library-and-path` (local commits, not pushed): Home, chapter path, reader layout, Test yourself. Details in the task file's status log
- **Lint:** 0 errors, 42 warnings (known debt, mostly unused variables)
- **Docs:** new setup in place (PRODUCT, ARCHITECTURE, AGENTS, CLAUDE, decisions/, tasks/, LEARNINGS). Old plans are in `docs/archive/`
- **Research (local, gitignored):** `research/competitive-teardown/COMPANION.md` + 23 figures from `Ingrain App.pdf`

## Unresolved problems

- **Non-goals and the success measure are still open** in PRODUCT.md. Core outcome and persona are written.
- **Architecture is proposed, not built.** New tables and `pdfjs-dist` are approved. **Slices 1 (upload), 2 (reader + Contents), 3 (highlights + comments) 4a (left overlay + resizable right panel) 4b (reflections with rich-text notes), 5 (chat) and 6 (Test tab + placeholder page) are built and browser-checked. All of Feature 1 is built, plus UX audit round 1 (icon selection menu, floating page/zoom pill, bottom-right chapter dock).** Slice 5 (chat, **Ask AI**, **Validate**) is built and was tested with a free Gemini model (`LLM_PROVIDER=gemini` is set on the dev deployment, key in the gitignored `.env.local`). **DeepSeek is untested.** **Ask AI** in the selection menu is wired but hidden until chat (slice 5). `documents` and `chunks` tables exist on the dev deployment.
- **Tests run twice from the main checkout.** Vitest also picks up copies in `.claude/worktrees/`. Fix: exclude `.claude/**` in `vitest.config.mts`.
- **Legacy code (courses, lessons, reviews, gamification) is untouched** until a feature replaces it.
- **Research lives only where it was created** (gitignored). Master copy is in the main checkout. 5 ambiguities are listed in companion §11.

## Next action

1. **Hemanth:** review slice 4 (Test yourself): open a book's path → 💡 Test on a chapter.
2. **Then:** slice 5 (XP, level, streak) of `tasks/feature-2-library-and-path.md`.
