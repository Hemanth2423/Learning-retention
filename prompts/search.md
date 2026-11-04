# Prompt log — Find things (feature 9)

## Prompt
> Build feature 9: search topics by keyword, filter by course or mastery, and sort by newest, oldest, or quiz score.

## What the agent did
- `topics.find` (server): loads only *my* topics, courses, attempts, and stars, then:
  - **search**: a keyword match in the title, summary, key points, or course title
  - **filter**: by course; by progress (mastered / needs work / not tested yet)
  - **sort**: newest, oldest, highest score, lowest score, A→Z
- `/find` page with a search box and 3 dropdowns; results update live as you type.

## Decision / change from plan
- Dropped the Convex full-text search index that was in the first schema. It only searched titles, while a simple filter over my own topics also covers summaries and key points, and one person's data is small. Simpler and more useful.

## Verified
Searched "anki" → 1 result (Spaced repetition), shown with its ★ and 80% best score.
