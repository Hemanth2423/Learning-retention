# Handoff

Update at the end of every session. Keep only the latest state, since git keeps the history.

**Last updated:** 2026-11-06 · **Branch:** `docs/project-setup`

## Last verified state

- **App:** main @ `14a43fe` (placement check merged). Live at https://recall-psi-five.vercel.app
- **Tests:** `npm test` → 36 tests in 11 files pass (2026-11-06)
- **Lint:** 0 errors, 42 warnings (known debt, mostly unused variables)
- **Docs:** new setup in place (PRODUCT, ARCHITECTURE, AGENTS, CLAUDE, decisions/, tasks/, LEARNINGS). Old plans are in `docs/archive/`

## Unresolved problems

- **PRODUCT.md is incomplete.** Core outcome and non-goals wait on Hemanth's new vision.
- **Tests run twice from the main checkout.** Vitest also picks up copies in `.claude/worktrees/`, so `npm test` shows 72. Fix: exclude `.claude/**` in `vitest.config.mts`.
- **Every existing feature is unreviewed against the new vision.** Keep, change or remove each one once PRODUCT.md is done.

## Next action

1. **Hemanth:** write the core outcome and non-goals in PRODUCT.md.
2. **Then:** list which existing features serve that outcome, and write the first `tasks/<feature>.md`.
