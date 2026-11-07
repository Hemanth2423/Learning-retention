# Prompt log — Stars (feature 8)

## Prompt
> Build feature 8: users can star topics and see a Starred view. All stars live in one `stars` junction table (userId + topicId), not one table per user.

## What the agent did
- `convex/stars.ts`: `toggle` (adds a row, or deletes it if it already exists), `isStarred`, `listMine`.
- The index `by_user_topic` makes "has this user starred this topic?" one lookup and keeps a single row per (user, topic).
- A ☆/★ Star button on each topic page, and a `/starred` page (most recently starred first) with an unstar button.
- Deleting a course also deletes the stars on its topics (added in feature 3).

## Verified
Starred "Spaced repetition" → the button switched to ★ Starred → it appeared on /starred.
