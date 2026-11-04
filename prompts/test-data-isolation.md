# Prompt log — Test 1: Data isolation

## Prompt
> Write the data isolation test from PLAN section 4: given User A has a course, when User B logs in, then User B can't see it. Then temporarily break the feature to show red, revert, and show green.

## Plain-English explanation (for the PR)
This test creates two users in a fake in-memory Convex database. User A gets a course, a topic, a quiz attempt, and a star. Logged in as User B, it then checks that B's course list, B's Find search, B's Starred list, and B's dashboard are all empty, and that opening User A's course or topic by its ID returns "not found". Finally it checks that User B **can't** edit, delete, or star User A's things, and that A's course title is unchanged afterwards.

## Red, then green
- **Break:** in `courses.list`, removed the `.withIndex("by_user", …)` filter so it returned every course in the database.
- **Red:** the test failed at `expect(await asB.query(api.courses.list, {})).toEqual([])`, because User B received "User A's secret course". → `Assignment/test-evidence/data-isolation-RED.txt`
- **Revert → green:** 1 passed. → `Assignment/test-evidence/data-isolation-GREEN.txt`
- (Take your own screenshots by running `npm test` in a terminal.)

## What would break it
Writing any new query that reads a table without filtering by the logged-in user (e.g. `ctx.db.query("topics").collect()`), or trusting a `userId` sent from the browser instead of `getAuthUserId`.

## Bug caught while writing the test
- convex-test couldn't find the `_generated` folder: the glob pattern from its docs (`!(*.*.*)`) doesn't work with Vite 8. Fixed with an explicit include/exclude list in `convex/test.setup.ts`.
