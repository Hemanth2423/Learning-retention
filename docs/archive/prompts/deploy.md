# Prompt log: Deploy

## The prompt

> Yes, deploy

## What was done

1. Logged the Convex and Vercel CLIs in through device-code links that I approved in my browser.
2. **Convex:** created the cloud project `recall`, which has a dev and a prod deployment, and deployed
   all functions to prod (`impartial-vole-835`).
3. **Convex prod env vars:** fresh auth keys (`JWT_PRIVATE_KEY`, `JWKS`, made by `scripts/generateAuthKeys.mjs`),
   `SITE_URL` (the live URL), `DEEPSEEK_API_KEY`, `FIRECRAWL_API_KEY`. A small script set them without
   printing the values.
4. **Vercel:** linked the project `recall`, set `NEXT_PUBLIC_CONVEX_URL` to the prod Convex URL,
   and ran `vercel deploy --prod`.

Live: https://recall-psi-five.vercel.app

## Problems hit

- **Convex login exited with an error** after saving the login, because it asked an interactive
  question ("link your anonymous deployment?"). The login itself had worked. I created a fresh
  cloud project instead of migrating local test data.
- **Vercel couldn't connect the GitHub repo** ("add a Login Connection to your GitHub account first").
  Until GitHub is connected in Vercel's dashboard, deploys are run from the CLI, not on every merge.
- Two of Vercel's URLs (`recall-nj-3089…`, the per-deploy URL) redirect to a Vercel login. That's
  Vercel's default deployment protection. `recall-psi-five.vercel.app` is the public production URL.

## Verification

- Every live route returns 200, and the site's JS bundle points at the prod Convex URL.
- The Convex prod auth endpoint (`/.well-known/openid-configuration`) returns 200.
