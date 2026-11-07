# Decisions

One file per architectural decision: `NNN-short-name.md`. Read one only when you touch what it covers.

**Add one when** a choice is hard to reverse, or a future agent might "fix" it without knowing why.

## Template (keep it under half a page)

```markdown
# NNN. Title
**Date:** YYYY-MM-DD · **Status:** accepted | replaced by NNN

**Context:** the problem, in 1–2 lines.
**Decision:** what we chose.
**Why:** the reason, and what we gave up.
```

## Index

| # | Decision |
|---|---|
| [001](001-convex-backend.md) | Convex for backend, database, storage and auth |
| [002](002-read-once-concept-model.md) | Read the PDF once; build lessons on demand |
| [003](003-question-rules-in-code.md) | Question rules live in code, not prompts |
