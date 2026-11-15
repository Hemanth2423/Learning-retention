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
- **Architecture is proposed, not built.** New tables and `pdfjs-dist` are approved. **Slices 1 (upload), 2 (reader + Contents), 3 (highlights + comments) and 4a (left overlay + resizable right panel) are built and browser-checked; 4b (reflections) and slices 5–6 are not.** Tiptap is approved but not installed yet. **Ask AI** in the selection menu is wired but hidden until chat (slice 5). `documents` and `chunks` tables exist on the dev deployment.
- **Tests run twice from the main checkout.** Vitest also picks up copies in `.claude/worktrees/`. Fix: exclude `.claude/**` in `vitest.config.mts`.
- **Legacy code (courses, lessons, reviews, gamification) is untouched** until a feature replaces it.
- **Research lives only where it was created** (gitignored). Master copy is in the main checkout. 5 ambiguities are listed in companion §11.

## Next action

1. **Hemanth:** review slices 1–4a (run `npm run dev`, open `/read`), and share a real book PDF with a table of contents.
2. **Then:** build 4b: install Tiptap, `reflections` table (with `dismissed`), the Gmail-style note (panel, Expand, Minimize), autosave and the end-of-chapter prompt. Validate comes with chat (slice 5).
