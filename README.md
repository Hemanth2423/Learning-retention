# Ingrain — read once, know it for good

Ingrain (formerly "Recall") turns a chapter or slide deck (PDF) into material built for **retention**:

- 🧠 a reasoned **concept map**: the book's 4–7 core ideas ("pillars"), grouped by idea rather than by chapter. It opens one level at a time with (+)
- 🖼️ a short **visual lesson** per pillar: a diagram (flow, cycle, comparison, 2×2, or hierarchy), teaching takeaways, a "common trap", and **real-world examples found by web search** (with source links)
- ✅ **adaptive checks** in each lesson: a new-scenario question first, then an easier one and a trickier one if you miss it. A pillar is mastered only when you apply it correctly
- 🧩 **Put it together**: end-of-course questions that need two pillars at once
- 📊 a **dashboard** (pillars mastered, accuracy, checks this week, accuracy-over-time chart)
- 🔎 **search / filter / sort** across all your pillars, plus ★ **stars** for a review list
- 🧭 an **honest progress report** (only answered checks count as "learned") with AI-suggested **next concepts and real resources**

**Live app:** https://recall-psi-five.vercel.app · **Product:** [PRODUCT.md](PRODUCT.md) · **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md)

## How it works
1. You sign up (email + password) and drop in a PDF with a title (subject optional).
2. The browser uploads the PDF straight to Convex file storage, and a background job reads it **once**:
   `unpdf` extracts the text → **DeepSeek V4 Pro** builds a concept model (thesis, pillars, sub-ideas, insights, misconceptions, links).
3. Lessons are built **on demand** by **DeepSeek Flash** from that model only (never the full PDF), plus Firecrawl web results.
   Pillar 1 is ready at upload; opening a pillar builds it and prefetches the next. Every call logs its token use (`[tokens]` in the Convex logs).
4. Check answers are graded on the server and saved in `answers`; the dashboard and progress report are computed from them.
5. Every query checks the logged-in user on the server, so you only ever see your own data.

## Tech
| | |
|---|---|
| Coding agent | Claude Code |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend + database + file storage | Convex |
| Auth | Convex Auth (email + password) |
| AI | DeepSeek API (`deepseek-flash`) |
| Web search | Firecrawl Search API |
| Libraries | unpdf (PDF text), Recharts (chart); the concept map is a custom React + SVG component |
| Tests | Vitest + convex-test |
| Hosting | Vercel (frontend) + Convex cloud (backend) |

## Run it locally
Requirements: Node 20+, a DeepSeek API key, a Firecrawl API key.

```bash
npm install
npx convex dev            # first run: log in / create a project; writes .env.local
```
In a second terminal, set the backend secrets once:
```bash
npx convex env set DEEPSEEK_API_KEY sk-...
npx convex env set FIRECRAWL_API_KEY fc-...
npx convex env set SITE_URL http://localhost:3000
node scripts/generateAuthKeys.mjs   # prints JWT_PRIVATE_KEY and JWKS; set both with `npx convex env set`
```
Then start the app:
```bash
npm run dev               # http://localhost:3000
```

## Tests
```bash
npm test
```
- `convex/dataIsolation.test.ts` — User B can't see, open, search, edit, or delete User A's data.
- `convex/dashboard.test.ts` — accuracy and mastery are computed correctly (3 of 5 right → 60%; only scenario questions master a pillar).
- `convex/lessonRules.test.ts` — the question rules: "according to the source" questions are rejected, answers stay correct after shuffling.

Red/green evidence: [`docs/archive/Assignment/test-evidence/`](docs/archive/Assignment/test-evidence/).

## Project layout
```
app/          pages (courses, topics, find, starred, dashboard)
components/   UI pieces (AuthForm, MindMap, Quiz, StarButton, ScoreChart, ProgressReport…)
convex/       backend: schema, queries/mutations, AI job, tests
decisions/    architectural decisions and why
tasks/        one spec per feature
docs/archive/ old plans, prompt logs, course deliverables
```
