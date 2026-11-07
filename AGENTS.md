<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ingrain: working rules for agents

Read this every session. Product and system context live in [PRODUCT.md](PRODUCT.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

## Commands

| What | Command |
|---|---|
| Backend (keep running) | `npx convex dev` |
| Frontend | `npm run dev` → http://localhost:3000 |
| Tests | `npm test` |
| Lint | `npm run lint` (0 errors required; warnings are known debt) |
| Build | `npm run build` |

Test accounts are in `.env.example`. Backend secrets are set with `npx convex env set` (see README).

## How a feature gets built

1. **Spec first.** A feature starts with `tasks/<feature>.md` (copy `tasks/_TEMPLATE.md`). No acceptance criteria means no code: ask for them.
2. **One branch, one PR per feature**, named `feat/…`, `fix/…` or `docs/…`.
3. **Flag deviations.** If the build differs from the task file, say so in the task file and the PR.
4. **Finish with HANDOFF.md:** the last verified state, open problems and the next action.

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
- Adding a dependency, an AI model or an external API
- Sending the full PDF to any step after the concept model
- Editing `convex/_generated/` or the Next.js block at the top of this file
- Deleting user data or running destructive commands against the Convex deployment
- Committing `.env.local` or any secret
- Pushing to `main` directly
