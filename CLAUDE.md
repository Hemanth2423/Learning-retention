# CLAUDE.md

@AGENTS.md

## What to read, and when

| File | What's in it | Read it |
|---|---|---|
| [ASSIGNMENT.md](ASSIGNMENT.md) | Course rules: team workflow, tests, required docs, grading | **Before any contribution** |
| [TEAM-PLAN.md](TEAM-PLAN.md) | Who builds which API feature, tests, done-when | Before any feature work |
| [PRODUCT.md](PRODUCT.md) | Target user, core outcome, non-goals | At the start of a feature |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System map, modules, data ownership, contracts | Before changing those components |
| [AGENTS.md](AGENTS.md) | Commands, conventions, testing, prohibited changes | Every session (imported above) |
| [decisions/](decisions/) | Short architectural decisions and why | Only when relevant |
| `tasks/<feature>.md` | Active specs (finished ones are in `docs/archive/tasks/`) | During that task |
| [HANDOFF.md](HANDOFF.md) | Last verified state, open problems, next action | Start and end of every session |
| [LEARNINGS.md](LEARNINGS.md) | What Hemanth has learned building this | When planning a feature |
| `research/` (local only) | Competitive research companions + figures | When writing a task or designing UX |

## Token budget (every session)
- **One slice per session.** Finish, update HANDOFF, then start a new session. Never carry on after a slice is done.
- **Start small:** read HANDOFF and the active spec only. Open other docs only if the task needs them.
- **Search, then read ranges.** Use `grep` and `sed -n`. Never read a whole file over 300 lines, a mockup, or `docs/archive/`.
- **Ignore legacy** unless asked: `app/{achievements,courses,dashboard,find,starred,today,topics}` and their backend.
- **Browser:** one end-to-end check per slice. Prefer page text; screenshot only for visual checks, at low scale.
- **Tests:** run targeted tests while building, and the full suite once before committing. Print only the summary.
- **No subagents or broad audits** unless Hemanth asks.

## Central rule: competitive research never goes into git

- **`research/` is gitignored. Never commit, push or paste its contents** into committed files, PRs or issues. Never force-add it (`git add -f`).
- **Use it as a local reference:** read the relevant companion section before writing a `tasks/<feature>.md` or designing UX, and cite it by figure ID (e.g. "research F15"), not by copying.
- **Weigh it thoughtfully:** treat `[Observed]` as fact, `[Author]` as Hemanth's opinion and `[Inference]` as a guess. Inspiration, not a spec: PRODUCT.md decides.
- If `research/` is missing (a fresh clone or worktree), say so and ask. Don't guess its contents.

## Principles (every session, every file)

### 1. Docs stay crisp
- **Max 1–2 pages per file.** If it grows past that, split it or cut it.
- **Exception:** research companions in `research/` may run 6–8 pages. Completeness of the evidence matters more there.
- **Structure over prose:** short headings, bullets, bold lead-ins, tables where they help.
- **Plain words.** Write for someone reading for the first time.

### 2. Chat replies stay crisp
- **Lead with the outcome**, then only the detail that matters.
- **Every recommendation gives What and Why**, a sentence or two each:
  - **What:** the thing to do
  - **Why:** the reason it's worth doing over the alternative

### 3. Ask when the structure is missing
Before building, check the task has what it needs. If anything is missing, **ask explicitly; don't guess**:
- [ ] Acceptance criteria (what "done" looks like for the user)
- [ ] A link to the core outcome in PRODUCT.md
- [ ] A design or UI reference, for anything visual
- [ ] Constraints (cost, speed, data, out of scope)
- [ ] How it will be verified

This applies when Hemanth's request skips a step, and also when an idea doesn't fit PRODUCT.md.
