# Ingrain: Product

Read this at the start of every feature. If a feature doesn't serve the target user and the core outcome, it doesn't get built.

## Target user

**Any non-fiction reader who wants to learn a subject**, not someone reading for leisure.

**Why narrow:** One kind of reader lets us judge every feature against one question: *did this reader learn it, not just read it?* The architecture stays general (other formats and topics later), but the MVP serves only this reader.

## Core outcome

> Reading often doesn't result in learning. Learning needs **reflection, application, and testing ourselves** until we feel challenged and a little vulnerable. That's where growth comes from.
> Ingrain gives readers those tools **without intruding on the reading itself.**

**Open:** how we'll measure it (e.g. reflections written, tests taken, return visits).
**MVP focus:** nail the **reading experience** first (Feature 1). Quizzing comes after.

## Non-goals

> **Open: Hemanth to write.** Things we're deliberately *not* doing in the MVP, each with a one-line reason.

## Feature 1: Reading experience

**Goal:** Upload a PDF and read it in a calm page, with contents, highlights, reflections and cited chat one click away.
**UX principle:** decluttered and simple. Panels stay closed until asked for.
**Research pointers (local):** upload F05, F15, F17 · left panel F01 · highlights + comments F07 · chat F02–F04.

### A. Upload
- [ ] The upload page has **one action: Upload PDF** (click, or drag and drop from the laptop). It asks nothing about quizzes or outputs.
- [ ] Accepts **PDF up to 25 MB**. A wrong type, a file over 25 MB, or an unreadable or password-protected file shows a plain message saying what to fix. Nothing is stored.
- [ ] Upload happens **in the page** (no modal) with a clear loading state: *Uploading (with %)* → *Preparing your book*. When ready, **the reader opens automatically.**
- [ ] If preparation fails, the page says so and offers **Try again**. No half-made documents are left behind.
- [ ] Built around a **source type** (PDF today). Links, YouTube or other formats can be added later as new options. Only PDF shows now.
- [ ] No document library. The upload page shows a quiet **Continue reading** link to the latest book. *(Assumed, not yet confirmed.)*

### B. Reader
- [ ] The PDF shows as readable pages: sharp, selectable text, scrolling, current page ("12 / 240") and zoom.
- [ ] Reopening a document returns the reader to the last page they were on.
- [ ] **Scanned (image-only) PDF:** reading works. Highlights and chat are switched off, with a one-line note saying why.
- [ ] Nothing competes with the page: panel buttons sit on the edges, plus the test button (E).

### C. Left panel: Contents and Highlights
- [ ] **Collapsed by default**, with an always-visible edge button (icon + label). Opening it resizes the page area, so it never covers the text.
- [ ] **Contents:** shows the PDF's table of contents, nested. Clicking an entry goes to **that exact page**. The current chapter is marked. No table of contents → "No contents found".
- [ ] **Highlights:** dragging the cursor over text shows a small menu: **Highlight** or **Highlight + comment**. The highlight shows in the page and in the panel at once.
- [ ] A comment is optional. It can be added, edited or deleted at any time, and shows under its highlight in the panel.
- [ ] The panel groups highlights **by chapter**, in reading order.
- [ ] Clicking a highlight in the panel goes to **its exact spot** in the page and briefly flashes it.
- [ ] Highlights and comments are saved per user and per document, and survive a reload. Only the owner can see them.

### D. Right panel: Reflections and Chat
- [ ] **Collapsed by default**, same edge-button pattern as the left.
- [ ] **Reflections:** at the end of a chapter, a gentle, dismissible prompt asks *"What did you learn?"* with a short text box. Skipping never blocks reading. It asks once per chapter. Saved reflections are listed by chapter and can be edited. *(Needs a table of contents; without one, no prompts.)*
- [ ] **Chat (this document only):** the reader asks and gets a **short answer, grounded in the PDF, with numbered citations**. It searches the whole book but **favors the chapter the reader is in**. Clicking a citation goes to the cited page. If the PDF doesn't contain the answer, it says so. *(Answer quality gets tuned later.)*
- [ ] **5 questions per user per day** (rolling 24 hours). The panel shows "3 left today"; at 0 it says when the next one frees up.
- [ ] **Quick replies** sit above the input, starting with **"Summarize this chapter"** (the chapter the reader is in). Quick replies count toward the 5. With no table of contents, it summarizes the current page and the next 4.
- [ ] Chat history is kept per document.

### E. Test your understanding
- [ ] Hidden while reading except for a **small tab** on the bottom edge. When scrolling begins it expands to **"Test your understanding"**, and **3 seconds later** it collapses again. It reappears the next time scrolling starts after a pause. *(Our reading of your note; confirm.)*
- [ ] It never covers text or distracts: no motion while the reader is selecting text, and it stays reachable by keyboard.
- [ ] Clicking opens a new page: a "Coming soon" placeholder until the quiz is designed.

### Constraints and scope
- **Desktop browsers only.** Uses the existing sign-in. Every record belongs to one user.
- **Source-agnostic core:** a document has a source type and readable chunks, so other formats can plug in later.
- **AI runs only when asked** (a chat message, "Summarize"), never on upload. Chat is capped at 5 per user per day.
- **Out of scope:** quiz content, Notion/Obsidian export, bookmarks, reading stats, OCR for scanned PDFs, formats other than PDF, a document library.
- **Verified by:** uploading a real PDF (one near 25 MB, one scanned, one with no contents) and walking through every box above in the browser. Report what was seen.

## How we pick features

- **Start from zero.** Earlier features (concept map, lessons, checks, spaced review, XP, placement, stars, search, dashboard) are *candidates*, not commitments. We keep one only if it serves the vision above.
- **One feature at a time.** Each feature gets a `tasks/<feature>.md` with acceptance criteria before any code.
- **"Done" means the user outcome happened**, not that the screen works (see [LEARNINGS.md](LEARNINGS.md)).

## Background

- Earlier plans, the learning-science research and the course reflection are in [docs/archive/](docs/archive/). Read them only when a task points to them.
