# PLAN.md — Learning Retention ("Recall")

_Written 2026-11-03, before any feature code._

## 1. Pitch

I'm building **Recall**, a web app that turns a chapter of a book or a slide deck into something built for *remembering*: a mind map, visual topic breakdowns with real-world examples, a short quiz per topic, and an honest report of what I've actually learned and what to study next. I'm building it because books are a poor format for retention, and I want to learn concepts, not just read them.

I'll use it **2–3 times a week** this semester, every time I start a new chapter or lecture deck. Any student can sign up and use it with their own material.

## 2. Features (build order)

Spine features are marked **[S]**. My own features are marked **[C]**.

1. **[S] Sign up / login.** As a new visitor, I want to create an account with email + password, log in, and log out, so that my courses and progress are private to me.
2. **[S] Data model + upload.** As a learner, I want to upload a PDF (max ~100 pages) with a title and subject, so that it becomes a *course* the app can break down.
3. **[S] CRUD.** As a learner, I want to see a list of my courses, open one course's detail page, edit its title/subject/notes, and delete it after an "Are you sure?" confirmation, so that I can keep my library tidy.
4. **[S] Validation.** As a learner, I want a friendly message when I leave a required field blank (title, PDF) or upload a non-PDF / oversized file, so that I know exactly what to fix.
5. **[C] AI topic breakdown.** As a learner, I want the app to split my document into 4–8 key topics, each with a plain summary, 3–5 key points shown as visual cards, and 2 **real-world examples found by web search (with source links)**, so that I see how the concept is used in reality, not in made-up analogies.
6. **[C] Mind map.** As a learner, I want an interactive mind map of the course (course → topics → sub-concepts), so that I see how the ideas break down and connect before I dive in.
7. **[C] Topic quizzes + concept-check progress.** As a learner, I want a 5-question multiple-choice quiz on each topic, with my score saved every time I take it, so that I can track whether I actually know the topic. A topic counts as **mastered** when my best score is ≥ 80%.
8. **[S] Stars.** As a learner, I want to star topics and open a "Starred" view, so that I have a review list of concepts I want to revisit.
9. **[S] Find things.** As a learner, I want to search topics/courses by keyword, filter by course or mastery (mastered / not yet), and sort by newest, oldest, or quiz score, so that I can find what to review.
10. **[S] Dashboard.** As a learner, I want a dashboard with summary stats (courses, topics mastered out of total, average quiz score, quizzes taken this week) and a chart of my quiz scores over time, so that I can see my real progress.
11. **[C] Honest progress report + next steps.** As a learner, I want each course to show what I've truly learned (based on quiz scores, not just pages read), which topics are weak, and 3–5 next concepts to learn with **real resources (links) from web search**, so that I know what to do next.

**V2 (not in this assignment):** Teach-back mode — I explain a concept to the AI and it questions me Socratically and corrects my wrong assumptions.

## 3. Database

Convex stores data as tables of documents. Every row gets an automatic `_id` (primary key) and `_creationTime` (date). References to other tables are typed IDs (`v.id("table")`), which play the role of foreign keys.

| Table | Columns (type) | Notes |
|---|---|---|
| **users** | `_id` (id, PK), `email` (text), `name` (text, optional), `_creationTime` (date) | Created by Convex Auth on sign-up. |
| **courses** | `_id` (PK), `userId` (→ users), `title` (text, required), `subject` (text), `notes` (text, optional), `fileId` (→ file storage), `pageCount` (number), `status` (text: `processing` / `ready` / `failed`), `mindMap` (text, markdown outline), `nextSteps` (list of {concept, why, resourceTitle, resourceUrl}), `_creationTime` (date) | One user → many courses. |
| **topics** | `_id` (PK), `courseId` (→ courses), `userId` (→ users), `order` (number), `title` (text), `summary` (text), `keyPoints` (list of text), `examples` (list of {title, description, sourceUrl}), `quiz` (list of {question, options[4], answerIndex, explanation}) | One course → many topics. `userId` copied for fast, safe per-user queries. |
| **quizAttempts** | `_id` (PK), `userId` (→ users), `topicId` (→ topics), `courseId` (→ courses), `score` (number, correct answers), `total` (number), `_creationTime` (date) | One topic → many attempts. |
| **stars** | `_id` (PK), `userId` (→ users), `topicId` (→ topics), `_creationTime` (date) | **Junction table**: many users ↔ many topics. One row = "this user starred this topic". Unique per (userId, topicId). |

```
users 1──* courses 1──* topics 1──* quizAttempts
  │                       │
  └──────*  stars  *──────┘      (many-to-many via stars)
```

**Isolation rule:** every query and mutation looks up the logged-in user on the server and only reads/writes rows where `userId` matches. Never trust a userId sent from the browser.

## 4. Tests

1. **Data isolation.** *Given* User A has uploaded a course with topics, *when* User B logs in and lists courses, opens User A's course by ID, or searches topics, *then* User B gets an empty list / "not found" and never sees User A's data.
2. **Dashboard stat.** *Given* a user has quiz attempts scoring 4/5, 3/5, and 5/5, *when* the dashboard stats are computed, *then* the average quiz score is exactly **80%** and quizzes taken = 3.

Both run with **Vitest + convex-test** (an in-memory Convex backend), so they don't touch real data.

## 5. Technologies

| Tool | Why |
|---|---|
| **Claude Code** (coding agent) | Works directly in my repo and terminal, so it can branch, test, and open PRs. |
| **Next.js (App Router) + TypeScript + Tailwind** | Popular, well documented, and deploys to Vercel in one step. |
| **Convex** (database, file storage, backend functions) | One TypeScript backend for data, PDF storage, and long-running AI jobs; queries update the UI live while a document is being processed. |
| **Convex Auth** (email + password) | Sign-up/login built into the same backend, so every account is a row in `users`. |
| **DeepSeek API** (`deepseek-chat`) | Low-cost LLM with JSON output for topics, mind maps, quizzes, and next steps. |
| **Firecrawl Search API** | DeepSeek can't browse the web, so Firecrawl search supplies real examples and resource links, avoiding invented URLs. |
| **unpdf** | Extracts text from uploaded PDFs, because DeepSeek reads text, not PDF files. |
| **markmap** | Renders a markdown outline as an interactive, zoomable mind map. |
| **Recharts** | Simple React charts for the dashboard. |
| **Vercel** (hosting) | Free, auto-deploys from GitHub `main`, made by the Next.js team. |

## 6. Design

Calm and focused, like a good notebook: warm off-white background (`#FAF8F3`), deep ink-navy text (`#1E2A3A`), one accent color (amber `#E8A33D`) for progress and stars, and green/red only for quiz right/wrong. Rounded cards, generous spacing, a clear serif for headings and a sans for body text. Dark mode is supported.

**Inspiration:** NotebookLM (mind map and source-grounded summaries), Duolingo (simple progress and mastery feedback), Linear (clean lists, keyboard-friendly).

## 7. Risks and cuts

- **Least sure I can build:** reliable AI processing of long PDFs. A whole book is too large for one LLM call. **Mitigation:** V1 caps uploads at ~100 pages (a chapter or a lecture deck), and processing runs as a background job with a visible status.
- **Second risk:** web-sourced examples that are irrelevant or come from weak sources. **Mitigation:** show the source link next to every example so I can judge it.
- **Cut first if time runs out:** feature 11's web-sourced resources (keep the "weak topics" part, drop the links). **Cut next:** the mind map becomes a simple indented outline instead of an interactive map.

---

## Plan vs. Reality

_To be filled in when the build is done._

| Planned feature | Shipped / Changed / Cut | Status (Done/Backlogged) | Learning | What changed and why (one line) |
|---|---|---|---|---|
| | | | | |
