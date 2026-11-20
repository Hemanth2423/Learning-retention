# 014. One Notebook: many notes per book, saved questions, text highlights
**Date:** 2026-11-19 · **Status:** accepted (Feature 3 slice 5)

**Context:** Each chapter had one note (`reflections`), highlights lived in their own tab, and test mistakes were lost. Readers want to write any number of notes, in any order, and keep everything in one place.
**Decision:**
- New `notes` table: any number per book, `sectionKey` optional (none = General notes), `seconds` for video notes. A chapter's first note still earns 20 XP once (books only).
- New `savedQuestions`: "📓 Save to notes" after a wrong answer copies the question, your answer and the right one **from the server's copy of the test** (`notebook.saveQuestion`); results never go in by themselves.
- Highlights in text sources store `range` (start/end block + character offset) with empty `segments`; the reader paints them with the CSS Custom Highlight API (no DOM changes, so React's rendering of the text is untouched).
- Old chapter notes were **moved**, not deleted: `notebook.migrateReflections` copies each into `notes` and clears its text; the `reflections` rows stay but nothing reads them.
- UI: Study tools tabs are Ask · Notebook · More. Writing and editing use one compose window with an explicit Save (closing with unsaved text asks first).
**Why:** One list matches how readers review and makes export one builder. Cost: a one-off migration per deployment (run `npx convex run notebook:migrateReflections` until it returns 0 after deploying).
