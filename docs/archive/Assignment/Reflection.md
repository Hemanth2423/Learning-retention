# Ingrain: Reflection

Hemanth NJ · Nov 4, 2026

Live app: https://recall-psi-five.vercel.app · Repo: https://github.com/Hemanth2423/Learning-retention · Plan: https://github.com/Hemanth2423/Learning-retention/blob/main/PLAN.md

I've always felt a book is a bad format for actually learning something. It's built to be read front to back, not to be remembered, and it's definitely not built for picking up a concept quickly. Ingrain is my attempt at fixing that for myself. I drop in a chapter or a slide deck, and the app pulls out the few core ideas that matter, shows how they connect, teaches each one with a simple diagram and a real example from the web, and then checks whether I can actually use the idea. It's something I'll use every week this semester, and I built it so other people can use it too.

My approach was to plan first, then let the agent build one feature at a time on its own branch while I checked each piece in the browser before merging. Claude Code wrote the code, Convex handles the database, logins and file storage, DeepSeek does the AI work, Firecrawl pulls real examples from the internet, and Vercel hosts it. Twenty four pull requests later the app works, but it isn't quite the app my plan described, and that gap turned out to be the most useful thing I learned.

## Plan vs. Reality

The biggest gap is in how the app teaches. My plan said the AI would split a document into 4 to 8 key topics, show 3 to 5 key points for each as cards, and give a 5 question quiz per topic, with 80% counting as mastered. That's exactly what the agent built first, and on paper it worked. It just didn't teach anything.

The first time I ran a real PDF end to end, the topics came back in chapter order. It was the table of contents with nicer cards. The quiz was worse. It asked me what encoding does according to the source and how many chunks working memory holds according to the source, and the right answers ran A, B, C, D down the page, so you could pass without reading a word. I patched the answer order in PR #32, but that was a patch on the wrong design. Then Devi tried it and got a question about what the observe step of the AI scientific method loop involves according to the source. Devi's reaction was basically, who cares what the source says, I care whether I understood the idea. That's the whole point of the app, and I had built a reading test.

The 5 questions and the 80% rule were my call, they're right there in my plan. The part that went sideways was the agent's. All I had asked for was a short test per chapter. The agent wrote its own instruction telling DeepSeek to ground the questions in the source, and logged it the same way. That one phrase is where every according to the source question came from. I know it was the agent's choice because it lives in the agent's prompt in convex/ai.ts and nowhere in anything I typed. I went along with it because I was checking that the feature worked, not that it taught. I scored 4 out of 5, saw Mastered, and moved on.

It cost me a lot. I rewrote the AI pipeline in PR #40 and the quiz system in PR #44, swapped the quiz attempts table for an answers table, deleted the two real courses we had already uploaded, redid both test write ups and the red and green evidence, and lost most of a day right before the demo. The one upside is that the new design is cheaper. The old version sent the whole PDF with every topic call, about seven times per document. The new one reads it once with a stronger model and only builds a lesson when someone opens it.

What I took away is that the agent will do exactly what the plan says, and my plan described screens, not learning. If I had written down what good looks like, for example that a growth chapter should come back as acquisition, activation, retention and monetization instead of chapters one, two and three, the agent would have had something to aim at. I rewrote features 5 to 7 that way, and the new version is in the evidence below.

## The stranger test

I handed the live app to my partner Devi, who isn't in this class, and watched for about ten minutes without helping. Devi made an account, uploaded a real document and tried to learn from it, and I wrote down every pause.

The first struggle came before anything useful happened. The file picker looked like every other field on the form, so Devi wasn't sure where the upload even was. Then the required Subject field stopped things. For a guide that isn't from a class, a subject didn't mean anything, and Devi had to make one up just to keep going.

The second was the mind map. Every node opened at once and it followed the document's sections, so it read like a table of contents. Devi wanted to see the core building blocks first and go deeper from there, the way NotebookLM does it, and sent me a NotebookLM screenshot to show what that looks like.

The third was the content itself. The key points felt bland, nothing you could learn from instead of reading the book, and the quiz kept asking what the source said rather than whether the idea made sense. By the end Devi had stopped trying to answer properly.

I fixed the upload first, in PR #38, because it's the front door. If you can't get a PDF in, none of the other features exist for you. The other two hurt learning more, but they only show up after a successful upload, and they were really the same gap as above, which needed a redesign rather than a quick fix. The upload was a clear, contained problem. Now there's a big drop zone with a round (+) at the top of the form. You can click it or drag a PDF onto it, it shows the file name once it's in, and Subject is optional in the form and on the server. I checked it in the browser, and an empty form now only asks for a title and a PDF. After that I went after the other two, with the new map in PR #42 and the lessons and questions in PRs #40 and #44.

What I chose not to fix is the wait. The first map takes about a minute and a half because a stronger reasoning model reads the whole PDF, and each new lesson takes 20 to 40 seconds. I could speed it up with a cheaper model or less reasoning, but the concept model is what everything else stands on, and I'd rather wait a minute than get a table of contents again. Building the next lesson in the background already hides most of that wait. I also left scanned PDFs unsupported (the app tells you so), a cramped menu on phones, and teach-back, which is still planned for V2. These are about speed and polish, not about whether a stranger can get value from the app. With the demo today, I'd rather show something that teaches well and is a little slow than something fast that teaches badly.

---

## Evidence

### Plan vs. Reality

- **The original plan:** features 5 and 7 in [PLAN.md lines 19 to 21](https://github.com/Hemanth2423/Learning-retention/blob/9bdadb97262c6c6bf5d8104ea4905be1e52fc2bb/PLAN.md#L19-L21), merged in [PR #2](https://github.com/Hemanth2423/Learning-retention/pull/2) before any feature.
- **Where it was built and then changed:**
  - [PR #12](https://github.com/Hemanth2423/Learning-retention/pull/12): topic breakdown
  - [PR #16](https://github.com/Hemanth2423/Learning-retention/pull/16): quizzes
  - [PR #32](https://github.com/Hemanth2423/Learning-retention/pull/32): answer order fix
  - [PR #40](https://github.com/Hemanth2423/Learning-retention/pull/40): concept model and visual lessons
  - [PR #44](https://github.com/Hemanth2423/Learning-retention/pull/44): adaptive checks
- **My original prompt** (paraphrased in [prompts/quizzes.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/quizzes.md)):

  > For each chapter we can have a short test and that can be recorded as a concept check progress

- **Where it went sideways.** The agent's log in [prompts/topic-breakdown.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/topic-breakdown.md):

  > DeepSeek picks up to 2 real examples from those search results and writes a 5-question quiz grounded in the source.

  The instruction the agent wrote for DeepSeek (convex/ai.ts, PR #12):

  > Exactly 5 quiz questions grounded in the SOURCE.

- **What came out of the first real run:** *What does encoding do, according to the source?*, with the right answers in order A, B, C, D ([prompts/fix-quiz-shuffle.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/fix-quiz-shuffle.md)).
- **Devi's feedback, as I passed it to the agent:**

  > According to the source, what does the 'observe' step of the AI scientific-method loop actually involve? -> Who cares what the source says, we care about the actual conceptual understanding itself

- **My prompt that turned it around:**

  > What is the best way to plan out our reasoning system to ensure that we are able to create an adequate pedagogy, while keeping the costs on check (I definitely want to minimize per document token consumption)

- **The agent's response** (full design in [prompts/concept-lessons.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/concept-lessons.md) and [prompts/adaptive-checks.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/adaptive-checks.md)):

  > In short, the AI reads the document carefully once, and every later step works from a compact summary of the ideas instead of the whole document.

### Rewritten plan, features 5 to 7

Written so a fresh agent with no memory of this project builds it right the first time.

**5. Concept model.** As a learner, I want the app to read my document once and pull out the 4 to 7 core ideas a smart friend would need, grouped by idea instead of by chapter and ordered so prerequisites come first, so that I can learn what the book teaches without reading all of it.
- One call to a strong reasoning model returns a one line thesis. For each idea it also returns:
  - a short title and a 1 to 2 sentence summary
  - 2 to 4 sub-ideas
  - 3 to 5 insights, each with a supporting phrase from the text
  - 2 to 3 common misconceptions
  - a search query for a real, documented case
  - how the ideas link to each other
- No later step ever sees the full document.
- Done means a product growth chapter comes back as acquisition, activation, engagement, retention and monetization, not as the chapter list.

**6. Concept map.** As a learner, I want a map that shows only the core ideas at first and opens one level at a time with a (+) on each node, so that I see the big picture before the detail. Clicking an idea opens its lesson.

**7. Lessons and checks.** As a learner, I want each idea as a short visual lesson that ends with questions about using it, so that mastered means I understood it.
- Build each lesson the first time it's opened, from the concept model and web results only. Each lesson has one diagram from a fixed set, 3 to 5 takeaways, one common trap and up to 2 real examples.
- Each idea gets three questions:
  - apply: a new scenario that isn't from the book
  - easier: the core idea, asked directly
  - stretch: an edge case, or a link to another idea
- Wrong options come from the misconceptions.
- These rules live in code, not in the AI:
  - reject any question that mentions the source, text, author or chapter
  - shuffle the options
  - grade on the server
- Show apply first. A wrong answer leads to easier, then stretch. Only a right apply or stretch answer counts as mastered.

### The stranger test

- **The fix for the top struggle:** [PR #38](https://github.com/Hemanth2423/Learning-retention/pull/38), a (+) drop zone with Subject made optional ([prompts/upload-dropzone.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/upload-dropzone.md)).
- **Follow-up fixes for the other two:**
  - [PR #42](https://github.com/Hemanth2423/Learning-retention/pull/42): the concept map, one level open with (+)
  - [PR #40](https://github.com/Hemanth2423/Learning-retention/pull/40) and [PR #44](https://github.com/Hemanth2423/Learning-retention/pull/44): visual lessons and adaptive checks
- **Devi's feedback as I passed it to the agent:**

  > Upload flow: let the pdf upload button be a (+) icon and easy to visually understand, Subject need not be mandatory
