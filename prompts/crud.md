# Prompt log — Create / read / update / delete (feature 3)

## Prompt
> Build feature 3: a course list, a course detail page, editing a course's title/subject/notes, and deleting it behind an "Are you sure?" confirmation.

## What the agent did
- `courses.get` / `update` / `remove` in `convex/courses.ts`. Each one checks that you own the course; a course that isn't yours behaves as if it doesn't exist.
- Delete also removes the course's topics, quiz attempts, stars, and the stored PDF, so nothing is left orphaned.
- `/courses/[id]`: detail page with an inline Edit form and a Delete button that opens a `ConfirmDialog`.

## Bug caught
- Opening `/courses/garbage` crashed the query, because Convex rejects a malformed ID before your code runs. Changed `get` to take a string and use `normalizeId`, so a bad link now shows "Course not found".

## Verified
In the browser: opened a course, edited its notes (saved and showed live), clicked Delete, saw the confirmation dialog, and cancelled.
