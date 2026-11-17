# Prompt log — Validation (feature 4)

## Prompt
> Build feature 4: required fields can't be blank, with a friendly message next to each field. Check the PDF too (missing, wrong type, too big).

## What the agent did
- `convex/validation.ts`: one set of rules, used by **both** the forms (instant feedback) and the Convex server (so someone can't skip the rules by calling the API directly).
- Title and subject are required (with length limits); notes are optional (max 1,000 characters); the PDF must exist, be a PDF, and be ≤ 20 MB.
- Messages say how to fix the problem ("Give your course a title so you can find it later."), not just "Required".
- Server errors are thrown as `ConvexError` and shown in a red banner on the form.

## Verified
Submitted an empty upload form → 3 messages appeared: title, subject, PDF.
