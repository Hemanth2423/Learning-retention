# CLAUDE.md

@AGENTS.md

## What to read, and when

| File | What's in it | Read it |
|---|---|---|
| [PRODUCT.md](PRODUCT.md) | Target user, core outcome, non-goals | At the start of a feature |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System map, modules, data ownership, contracts | Before changing those components |
| [AGENTS.md](AGENTS.md) | Commands, conventions, testing, prohibited changes | Every session (imported above) |
| [decisions/](decisions/) | Short architectural decisions and why | Only when relevant |
| `tasks/<feature>.md` | Acceptance criteria, constraints, files, status | During that task |
| [HANDOFF.md](HANDOFF.md) | Last verified state, open problems, next action | Start and end of every session |
| [LEARNINGS.md](LEARNINGS.md) | What Hemanth has learned building this | When planning a feature |

## Principles (every session, every file)

### 1. Docs stay crisp
- **Max 1–2 pages per file.** If it grows past that, split it or cut it.
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
