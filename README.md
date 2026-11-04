# Recall — learn it, don't just read it

Recall turns a chapter or slide deck (PDF) into material built for **retention**:

- 🧠 an interactive **mind map** of the concepts
- 🗂️ **key topics**, each with a plain summary, visual key-point cards, and **real-world examples found by web search** (with source links)
- ✅ a 5-question **quiz per topic**; your best score tracks mastery (≥ 80% = mastered)
- 📊 a **dashboard** (topics mastered, average score, quizzes this week, score-over-time chart)
- 🔎 **search / filter / sort** across all your topics, plus ★ **stars** for a review list
- 🧭 an **honest progress report** (only quiz results count as "learned") with AI-suggested **next concepts and real resources**

**Live app:** _coming soon (Vercel)_ · **Plan:** [PLAN.md](PLAN.md) · **Database:** [schema.md](schema.md)

## How it works
1. You sign up (email + password) and upload a PDF with a title and subject.
2. The browser uploads the PDF straight to Convex file storage, and a background job starts:
   `unpdf` extracts the text → DeepSeek writes the outline/mind map and topics → for each topic, Firecrawl searches the web for real cases and DeepSeek writes a quiz.
3. The course page updates live as the job finishes (Convex queries are reactive).
4. Quizzes are graded on the server and saved as `quizAttempts`; the dashboard and progress report are computed from them.
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
| Libraries | unpdf (PDF text), markmap (mind map), Recharts (chart) |
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
- `convex/dashboard.test.ts` — the average quiz score is computed correctly (4/5, 3/5, 5/5 → 80%).

Red/green evidence: [`Assignment/test-evidence/`](Assignment/test-evidence/).

## Project layout
```
app/          pages (courses, topics, find, starred, dashboard)
components/   UI pieces (AuthForm, MindMap, Quiz, StarButton, ScoreChart, ProgressReport…)
convex/       backend: schema, queries/mutations, AI job, tests
prompts/      prompt log for every feature
Assignment/   course deliverables (reflection, screenshots, test evidence)
```
