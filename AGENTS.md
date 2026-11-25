<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ingrain: working rules for agents

Read this every session. Product and system context live in [PRODUCT.md](PRODUCT.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Before any contribution: read ASSIGNMENT.md

This repo is a graded team project. **Read [ASSIGNMENT.md](ASSIGNMENT.md) and [TEAM-PLAN.md](TEAM-PLAN.md) before writing code or opening an issue or PR.** They set the workflow, test and doc rules below. If a request would break them, say so and ask.

## Team workflow (issues, branches, PRs)

Every change, even a one-line doc fix, follows this loop:

1. **Issue first.** Find or open a GitHub Issue for the work and assign it to the person you're working for. For an API feature, paste its user story from TEAM-PLAN.md.
2. **Branch from the latest `main`** (`git pull` first). One branch per issue: `api/…`, `feat/…`, `fix/…` or `docs/…`.
3. **Log key prompts** in `prompts/<feature>.md`.
4. **Open a PR into `main`** with what changed, `closes #N`, a screenshot of it working and any merge conflict you resolved. A feature PR also includes its test, a plain-English explanation of that test and "what would break it".
5. **Review.** At least 1 teammate approves; authors can't approve their own. Address comments by pushing to the same branch.
6. **Merge** only when approved **and CI is green**. The human author merges; agents never merge on their own.
7. **Never commit or push to `main`.** Never break a teammate's test to get yours green.

Use the `gh` CLI for issues and PRs. Issues, PRs and review comments are visible to the whole team, so confirm the wording with the person before posting.

## Commands

| What | Command |
|---|---|
| Backend (keep running) | `npx convex dev` |
| Frontend | `npm run dev` → http://localhost:3000 |
| Tests | `npm test` |
| Lint | `npm run lint` (0 errors required; warnings are known debt) |
| Build | `npm run build` |

Test accounts are in `.env.example`. Backend secrets are set with `npx convex env set` (see README).

## Team assignment rules (temporary, until the Dec 2 demo)

This repo is shared by the CodeMates team. Until the demo, these rules override anything below that conflicts with them. Revert this section and the two lines marked "temporary" after the assignment.

- **Start every session** with: "Read docs/archive/PLAN.md and TEAM-PLAN.md. Today I'm building ___." (`docs/archive/PLAN.md` is the app's original PLAN.md.)
- **Issue → branch → PR.** Open an Issue with your user story from TEAM-PLAN.md, assigned to yourself. Branch from the latest `main` (`api/<feature>` for API features, `docs/…` for docs). The PR says what changed, includes `closes #N`, a screenshot, a plain-English explanation of your test and one sentence on what would break it.
- **Review and merge.** At least one teammate approves (you can't approve your own). CI (`npm test`, `npm run lint`) must be green. Then **the author merges**. `main` is protected; never push to it.
- **Approved scope.** The APIs, tables and libraries listed in TEAM-PLAN.md are approved. Still update ARCHITECTURE.md when you add a table.
- **APIs are called from the server only** (Convex actions or HTTP routes). Keys live in Convex env (`npx convex env set`), never in the browser or in git.
- **Save your key prompts** in `prompts/<feature>.md`. Pull `main` often; resolve conflicts with your agent and mention them in the PR.

## How a feature gets built

1. **Spec first.** A feature starts with `tasks/<feature>.md` (copy `tasks/_TEMPLATE.md`). No acceptance criteria means no code: ask for them.
2. **One branch per feature**, from its issue (see Team workflow above). Build and verify it **locally** first.
3. **Never merge a PR yourself.** The human author merges after a teammate approval and green CI.
4. **Flag deviations.** If the build differs from the task file, say so in the task file and the PR.
5. **Finish with HANDOFF.md:** the last verified state, open problems and the next action.

## Conventions

- **Backend logic lives in `convex/`.** Pure rules go in their own files (e.g. `spacing.ts`, `questionRules.ts`) so they can be unit-tested.
- **Access:** start every public function with `requireUser`, and load courses with `getOwnCourse`.
- **AI:** call models only through `llm.ts`, and only from actions. Rules that must always hold go in code, not in the prompt.
- **Copy:** plain, short, friendly. No jargon in the UI.

## Testing requirements

- `npm test` passes before every PR.
- **Every new server rule gets a test** (grading, scheduling, access, scoring).
- **UI changes get a browser check** with a real PDF, end to end. Report what you saw.
- **"Works" means the user outcome in the task file happened**, not just that the page renders.

## Prohibited without asking first

- Changing `convex/schema.ts` (also update ARCHITECTURE.md and add a `decisions/` entry)
- Adding a dependency, an AI model or an external API **that isn't listed in [TEAM-PLAN.md](TEAM-PLAN.md)** (team assignment, temporary: APIs, tables and libraries approved there don't need a separate ask)
- Sending the whole book to the model in one call (use retrieved passages or the current chapter)
- Editing `convex/_generated/` or the Next.js block at the top of this file
- Deleting user data or running destructive commands against the Convex deployment
- Committing `.env.local` or any secret
- Pushing to `main` directly
