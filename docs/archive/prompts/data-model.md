# Prompt log — Data model + upload (feature 2)

## Prompt
> Build feature 2 from PLAN.md: the full Convex schema (courses, topics, quizAttempts, stars + users from Convex Auth) and a "New course" form that uploads a PDF with a title and subject.

## What the agent did
- `convex/schema.ts`: all 4 app tables from PLAN section 3, with indexes for per-user queries and a text search index on topic titles.
- `convex/helpers.ts`: `requireUser()` always gets the user from the session, never from the browser. `getOwnCourse()` returns a course only if you own it.
- `convex/courses.ts`: `generateUploadUrl` → browser uploads the PDF straight to Convex file storage → `create` saves the course row with status `processing`.
- `/courses` lists your courses (newest first). `/courses/new` is the upload form.

## Differences from the plan
- Added `statusMessage` to courses so a failed AI run can say why.

## Verified
Uploaded a sample PDF in the browser; a course row was created and the app navigated to its ID.
