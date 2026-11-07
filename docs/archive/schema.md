# schema.md — Ingrain database

Ingrain uses **Convex**. Each table holds documents; every row automatically gets `_id` (primary key) and `_creationTime` (date). A column typed `→ table` stores that table's `_id`: it's the foreign key. The source of truth is [`convex/schema.ts`](convex/schema.ts) (lesson shapes in [`convex/lessonTypes.ts`](convex/lessonTypes.ts)).

## Diagram

```mermaid
erDiagram
  users ||--o{ courses : "owns"
  courses ||--o{ topics : "is broken into (pillars)"
  topics ||--o{ answers : "is checked by"
  courses ||--o{ answers : "has"
  users ||--o{ answers : "gives"
  users ||--o{ stars : "stars"
  topics ||--o| reviews : "is scheduled by"
  users ||--o{ reviews : "reviews"
  users ||--o| profiles : "has"
  users ||--o{ achievements : "earns"
  topics ||--o{ stars : "is starred in"

  users { id _id PK
    text email
    date _creationTime }
  courses { id _id PK
    id userId FK
    text title
    text subject
    text notes
    id fileId
    number pageCount
    text status
    text statusMessage
    text thesis
    list conceptLinks
    object capstone
    object placement
    list nextSteps
    date _creationTime }
  topics { id _id PK
    id courseId FK
    id userId FK
    number order
    text title
    text summary
    list subIdeas
    list insights
    list misconceptions
    text lessonStatus
    object lesson
    list examples
    list questions
    object predict
    text placement }
  answers { id _id PK
    id userId FK
    id courseId FK
    id topicId FK
    text checkId
    text level
    text type
    bool correct
    date _creationTime }
  reviews { id _id PK
    id userId FK
    id courseId FK
    id topicId FK
    date dueAt
    number intervalDays
    number successes
    date lastRecallAt
    number longestGapDays }
  profiles { id _id PK
    id userId FK
    number xp
    number streak
    number longestStreak
    number lastActiveDay
    number freezes }
  achievements { id _id PK
    id userId FK
    text kind
    text refId
    text label
    text subject
    date _creationTime }
  stars { id _id PK
    id userId FK
    id topicId FK
    date _creationTime }
```

## Tables

### users
Created by Convex Auth when someone signs up. Columns: `_id`, `email` (text), `_creationTime` (date). Convex Auth also adds internal tables (`authAccounts`, `authSessions`, …) that store password hashes and sessions; the app never reads them directly.

### courses — one uploaded PDF
| Column | Type | Notes |
|---|---|---|
| `userId` | → users | owner |
| `title` | text | required, ≤ 120 chars |
| `subject` | text | optional (empty string = none), ≤ 60 chars |
| `notes` | text (optional) | ≤ 1,000 chars |
| `fileId` | → file storage | the PDF |
| `pageCount` | number (optional) | set after processing |
| `status` | text | `processing` / `ready` / `failed` |
| `statusMessage` | text (optional) | progress or error shown to the user |
| `thesis` | text (optional) | the one big idea from the concept model |
| `conceptLinks` | list of {from, to, relation} (optional) | how pillars connect, e.g. "feeds into" |
| `capstone` | {status, error?, checks[]} (optional) | end-of-course "connect" questions, built on demand |
| `placement` | {status, error?, questions[{topicId, question}]} (optional) | the placement check: one `choice` question per pillar, built on demand. Status `generating` / `ready` / `failed` / `skipped` / `done`. Answer keys are hidden from the browser |
| `nextSteps` | list of {concept, why, resourceTitle, resourceUrl} (optional) | AI suggestions + real links |
| `mindMap` | text (optional) | legacy; the concept map is now drawn from `topics` |

### topics — one pillar (core idea) of a course
| Column | Type | Notes |
|---|---|---|
| `courseId` | → courses | parent course |
| `userId` | → users | copied from the course so every query can filter by owner |
| `order` | number | learning order (prerequisites first) |
| `title`, `summary` | text | |
| `subIdeas` | list of {title, detail, children[]} | the levels of the concept map |
| `insights` | list of {text, quote} | what the lesson must teach, with a supporting phrase |
| `misconceptions` | list of text | become the "common trap" and the wrong answer options |
| `searchQuery` | text | for finding real-world examples |
| `lessonStatus` | text | `pending` / `generating` / `ready` / `failed`: lessons are built on demand |
| `lesson` | {hook, why?, visual, takeaways[], trap?} (optional) | `why` = {problem, idea}: the problem the idea solves, shown first. `visual` is one of 5 templates: flow, cycle, compare, matrix, hierarchy |
| `examples` | list of {title, description, sourceUrl} | real cases from web search |
| `questions` | list of typed questions (optional) | the practice bank, 4–8 per pillar. Types: `choice` (style apply / spot / why / core), `order`, `match`, `gap`. Levels `easier` / `apply` / `stretch`. Answer keys and explanations are never sent to the browser before answering |
| `placement` | text (optional) | placement result: `known` (skipped; first spaced review tomorrow), `shaky` (a wrong guess, so the guess question is skipped), `new` ("I don't know yet"). Not saved to `answers` |
| `predict` | one `choice` question (optional) | asked before the lesson on a first visit. Graded so the answer can be shown, but never saved to `answers` |
| `checks` | list of {id, level, question, options[4], answerIndex, explanation} | legacy V1 pool of 3 questions; served as `choice` questions when a pillar has no `questions` |

### answers — every check question answered
`userId` → users, `courseId` → courses, `topicId` → topics (empty for end-of-course questions), `checkId`, `level` (`apply` / `easier` / `stretch` / `connect`), `type` (`choice` / `order` / `match` / `gap`, optional), `context` (`review` for Today answers, empty for lesson answers), `correct` (true/false), `_creationTime` (when). A pillar is **mastered** once an `apply` or `stretch` answer is correct.

### reviews — the spaced-review schedule, one row per mastered pillar
`userId` → users, `courseId` → courses, `topicId` → topics, `dueAt` (date), `intervalDays`, `successes` (correct review recalls, at most one per day), `lastRecallAt` (date), `longestGapDays`. Created when a pillar is first mastered, with the first review due the next day. A right answer grows the gap (1 → 3 → 7 → 21 → ×2.5 days), and a miss brings it back tomorrow. **Ingrained** = 3+ successes and a gap of 7+ days. Rules in [`convex/spacing.ts`](convex/spacing.ts).

### profiles — XP, level and streak, one row per user
`userId` → users, `xp`, `streak`, `longestStreak`, `lastActiveDay` (local day number of the last answer), `freezes`. The level is computed from `xp` (Curious 0 → Learner 100 → Thinker 300 → Expert 700 → Sage 1500). Rules in [`convex/gamification.ts`](convex/gamification.ts).

### achievements — earned badges
`userId` → users, `kind` (`first-answer`, `pillar-mastered`, `ingrained`, `course-completed`, `comeback`, `streak-3/7/30`, `level-<name>`), `refId` (the pillar or course id, or empty), `label` and `subject` (what the card shows), `_creationTime` (earned date). At most one row per (user, kind, refId), enforced by the `by_user_kind_ref` check in `rewards.award`. Achievements stay when a course is deleted.

### stars — junction table
`userId` → users, `topicId` → topics. One row = "this user starred this pillar". One table for everyone; at most one row per (user, topic), enforced by the `by_user_topic` index check in `stars.toggle`.

## Relationships in plain English
- A **user** has many **courses** (one-to-many).
- A **course** has many **topics** (pillars) (one-to-many).
- A **topic** has many **answers** (one-to-many); each answer also belongs to one user and one course.
- **Users ↔ topics** is many-to-many through **stars**.

## Plan vs. built (compared with PLAN.md section 3)
- ✅ The planned tables were built: users, courses, topics, stars (junction).
- 🔁 **`quizAttempts` was replaced by `answers`** when the 5-question quizzes became adaptive checks: we now store each answer, not one score per quiz, because mastery depends on *which* question was answered right.
- 🔁 **`topics` became pillars of a concept model**: `keyPoints` and `quiz` were replaced by sub-ideas, insights, misconceptions, an on-demand `lesson`, and a 3-question `checks` pool.
- ➕ Added `courses.statusMessage` so failures are visible instead of a stuck spinner; `thesis`, `conceptLinks`, and `capstone` support the concept model.
- ➖ Removed a full-text search index on `topics.title`; search filters the user's own topics instead (see `prompts/search.md`).
- ↔ `nextSteps` lives as a list on `courses` (as planned): it's always replaced as a whole and never queried on its own.
