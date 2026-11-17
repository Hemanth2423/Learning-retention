# Prompt log — Mind map (feature 6, my feature #2)

## Prompt
> Show a mind map of the high-level concepts and how they break down from each other (like NotebookLM).

## What the agent did
- The AI outline call already returns the mind map as a **markdown outline** (`# course → ## topic → - sub-concept`), stored in `courses.mindMap`.
- `components/MindMap.tsx` renders it with **markmap**: zoom, pan, click a node to fold it, plus a Re-center button. Its colors follow light/dark mode.

## Bug caught
- The map rendered **blank** at first. Cause: React (in dev) mounts components twice, and the code reused a map object that the first unmount had already destroyed. Fixed by creating and destroying the map in the same effect. I noticed it because the SVG had zero child elements in the browser.

## Verified
Loaded a course with an outline: the map shows the course → 5 topics → sub-concepts.
