# Prompt log — Sign up and login (feature 1)

## Prompt
> Let's go ahead with the plan. (Build feature 1: email + password sign up, log in, log out with Convex Auth. Each account must be a row in `users`.)

## What the agent did
- Scaffolded Next.js 16 + Tailwind 4 and added Convex + Convex Auth (Password provider).
- Used the **client-side** Convex Auth provider instead of Next.js middleware: Next 16 renamed middleware, and all data access is checked on the Convex server anyway.
- Added a landing page with a sign up / log in form (friendly errors for a blank email, a bad email, or a short password), plus an `AppShell` that redirects logged-out visitors and has a Log out button.

## Bugs caught
- Tailwind v4 refused `@apply btn` (you can't `@apply` your own class in v4). Fixed by inlining the shared button styles.
- `npm install` failed on peer versions (`@auth/core` 0.37 vs 0.41, `@types/node` 20 vs vitest). Fixed by installing the versions the packages asked for.

## Verified
Signed up as `test-a@recall.test` in the browser and landed on /courses showing that email.
