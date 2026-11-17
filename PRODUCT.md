# Ingrain: Product

Read this at the start of every feature. If a feature doesn't serve the target user and the core outcome, it doesn't get built.

## Target user

**Any non-fiction reader who wants to learn a subject**, not someone reading for leisure.

**Why narrow:** One kind of reader lets us judge every feature against one question: *did this reader learn it, not just read it?* The architecture stays general (other formats and topics later), but the MVP serves only this reader.

## Core outcome

> Reading often doesn't result in learning. Learning needs **reflection, application, and testing ourselves** until we feel challenged and a little vulnerable. That's where growth comes from.
> Ingrain gives readers those tools **without intruding on the reading itself**, and makes learning **fun and meaningful**.

**Open:** how we'll measure it (e.g. notes written, tests taken, return visits).

## Experience principles

- **Calm while reading.** The page comes first. Tools hide until asked for, and every panel opens and closes in one click.
- **Earthy reader, old-school game layer.** Paper and linen, a warm serif for reading, terracotta for actions, sage for done. Tests and progress use a retro game look: chunky buttons, hearts, XP, levels.
- **Discoverable.** Every icon names itself on hover. Key actions sit where readers expect them.
- **Design reference:** the local prototype `.context/compound-engineering/ce-prototype/2026-11-16-reader-ux/` (mockup 3 is the agreed flow; gitignored).

## The flow

**Home** (your books) → **Chapter path** (the journey for one book) → **Reader** → **end of chapter** → **write a note** or **test yourself**.

## Features

| # | Feature | Status | Spec |
|---|---|---|---|
| 1 | Reading experience: upload, reader, highlights, notes, cited chat | Built, on `feat/reading-experience` | [tasks/feature-1-reading.md](tasks/feature-1-reading.md) |
| 2 | Library, chapter path, 5-question tests, XP, new reader layout | Spec, waiting for open questions | [tasks/feature-2-library-and-path.md](tasks/feature-2-library-and-path.md) |

## Non-goals

> **Open: Hemanth to write.** Things we're deliberately *not* doing in the MVP, each with a one-line reason. Known so far: no stars (for now), no spaced review of missed questions (a "review missed" button instead), no generated book covers.

## How we pick features

- **Start from zero.** Earlier features (concept map, lessons, checks, spaced review, XP, placement, stars, search, dashboard) are *candidates*, not commitments. We keep one only if it serves the vision above.
- **One feature at a time.** Each feature gets a `tasks/<feature>.md` with acceptance criteria before any code.
- **"Done" means the user outcome happened**, not that the screen works (see [LEARNINGS.md](LEARNINGS.md)).

## Background

- Earlier plans, the learning-science research and the course reflection are in [docs/archive/](docs/archive/). Read them only when a task points to them.
