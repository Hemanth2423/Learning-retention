# Handoff

Update at the end of every session. Keep only the latest state, since git keeps the history.

**Last updated:** 2026-11-17 · **Branch:** `feat/library-and-path` (from `feat/reading-experience`; that branch is deleted once this reaches main; no merges until Hemanth says so)

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

## Next action

1. **Hemanth:** review slices 4–5 (Test yourself, XP), then commit slice 5.
2. **Then:** Feature 2 is complete: a full pass with a real book, then a PR (never merged without Hemanth's OK).
