# Ingrain: Product

Read this at the start of every feature. If a feature doesn't serve the target user and the core outcome, it doesn't get built.

## Target user

**Self-directed learners working through an AI book** who struggle to:
- **Retain** the concepts once they've read them
- **Apply** what they read to real, practical work

**Why so narrow:** One user and one kind of content let us judge every feature against one question: *did this reader keep the idea and use it?* The architecture stays general so we can add other topics later, but the MVP serves only this reader.

## Core outcome

> **Open: Hemanth to write the new vision.**
> One sentence on what the user can do after using Ingrain that they couldn't do before, plus how we'll measure it.

## Non-goals

> **Open: Hemanth to write.** Things we're deliberately *not* doing in the MVP, each with a one-line reason.

## How we pick features

- **Start from zero.** Earlier features (concept map, lessons, checks, spaced review, XP, placement, stars, search, dashboard) are *candidates*, not commitments. We keep one only if it serves the vision above.
- **One feature at a time.** Each feature gets a `tasks/<feature>.md` with acceptance criteria before any code.
- **"Done" means the user outcome happened**, not that the screen works (see [LEARNINGS.md](LEARNINGS.md)).

## Background

- Earlier plans, the learning-science research and the course reflection are in [docs/archive/](docs/archive/). Read them only when a task points to them.
