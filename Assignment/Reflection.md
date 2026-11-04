# Reflection: Ingrain (Solo App)

Hemanth NJ · MBA/EWMBA · Nov 4, 2026

- Live app: https://recall-psi-five.vercel.app
- Repo: https://github.com/Hemanth2423/Learning-retention
- Plan (with Plan vs. Reality): https://github.com/Hemanth2423/Learning-retention/blob/main/PLAN.md

---

## 1. Plan vs. Reality

The biggest gap between my plan and what I shipped is how the app actually teaches. My plan said the AI would split a document into 4 to 8 key topics, each with 3 to 5 key points shown as cards, and then give a 5 question quiz per topic, with a topic counted as mastered at 80%. That is exactly what got built first, and it worked. It just didn't teach anything.

When I ran a real PDF through it end to end, the topics came back in the same order as the chapters. It was basically the table of contents with nicer cards. The quiz was worse. The first real run gave me questions asking what encoding does according to the source, and how many chunks working memory holds according to the source. On top of that, the right answers were almost always A, B, C, D in order, so you could pass without reading anything. I fixed the answer order in code (PR #32), but that was a patch on the wrong design.

Then Devi used it and said what I was half seeing myself. One of the questions asked what the observe step of the AI scientific method loop involves according to the source. Devi's reaction was basically, who cares what the source says, I care whether I understood the idea. That is the whole point of the app, and I had built a reading test.

**Who decided?** The 5 questions and the 80% rule were mine, I wrote them into the plan. The part that went sideways was the agent's. My original ask was a short test per chapter. The agent's own prompt to DeepSeek said to write 5 questions grounded in the SOURCE, and its log says the same thing. That one word is where all the according to the source questions came from. I can tell it was the agent's call because it sits in the agent's prompt in convex/ai.ts and in its prompt log, not in anything I typed. I went along with it because my check was functional. I answered 4 of 5, saw 80% and Mastered, and moved on. I was testing whether the feature worked, not whether it helped someone learn.

**What it cost me.** A full rewrite of the AI pipeline (PR #40) and of the quiz system (PR #44), a schema change that replaced quizAttempts with answers, deleting the two real courses we had already uploaded, redoing both test write ups and the red and green evidence, and most of a day right before the demo. The one upside is that the new design is also cheaper. The old version sent the whole PDF in every topic call, roughly 7 times per document. The new one reads it once with a stronger model and builds each lesson only when someone opens it.

The bigger lesson for me is about judgment. The agent is great at doing exactly what the plan says. My plan described the screens, not the learning. If I had written what good looks like, for example that a growth chapter should come back as acquisition, activation, retention and monetization rather than chapter 1, 2 and 3, the agent would have had something to aim at.

### Rewritten plan section (features 5 to 7)

Written so a fresh agent with no memory of this project builds it right the first time.

**5. [C] Concept model.** As a learner, I want the app to read my document once and pull out the 4 to 7 core ideas (pillars) a smart friend would need, grouped by idea and not by chapter, and ordered so prerequisites come first, so that I can learn what the book teaches without reading all of it.
- One AI call reads the full text with a strong reasoning model. It returns a one sentence thesis, and for each pillar: a title (5 words max), a 1 to 2 sentence summary, 2 to 4 sub-ideas with 0 to 3 finer points each, 3 to 5 insights each with a short supporting phrase from the text, 2 to 3 common misconceptions, and a web search query for a real, documented case. It also returns links between pillars, like feeds into or trades off against.
- No later step gets the full document. Everything after this works from the concept model only.
- Done means: a product growth chapter comes back as acquisition, activation, engagement, retention and monetization, not as the chapter list.

**6. [C] Concept map.** As a learner, I want a map that starts with only the pillars visible and lets me open one level at a time with a (+) on each node, so that I see the big picture first. Clicking a pillar opens its lesson.

**7. [C] Lessons and checks.** As a learner, I want each pillar as a short visual lesson that ends with a couple of questions that test whether I can use the idea, so that mastered means I understood it, not that I remember the wording.
- Build a lesson the first time a pillar is opened (and the next pillar in the background), from the concept model plus web search results. Each lesson has one visual from a fixed set (flow, cycle, comparison table, 2x2, hierarchy) that the app draws, 3 to 5 takeaways that teach on their own, one common trap, and up to 2 real examples tied to actual search results.
- Each pillar gets 3 questions: apply (a new scenario that is not from the book), easier (the core idea, asked directly) and stretch (an edge case or a link to another pillar). Wrong options come from the misconceptions.
- Rules live in code, not in the AI: reject any question that mentions the source, text, author, chapter or document, shuffle the options, and grade on the server.
- Flow: apply first. Right means mastered. Wrong shows the explanation, then easier, then stretch. Stretch right means mastered, otherwise the pillar goes on the needs work list.
- Mastered means an apply or stretch question answered right. The easier question alone never counts.

### Evidence for question 1

- **The line in my plan:** features 5 and 7, [PLAN.md lines 19 to 21](https://github.com/Hemanth2423/Learning-retention/blob/9bdadb97262c6c6bf5d8104ea4905be1e52fc2bb/PLAN.md#L19-L21) (merged in [PR #2](https://github.com/Hemanth2423/Learning-retention/pull/2) before any feature).
- **PRs where it was built, then changed:** [#12 topic breakdown](https://github.com/Hemanth2423/Learning-retention/pull/12), [#16 quizzes](https://github.com/Hemanth2423/Learning-retention/pull/16), [#32 answer order fix](https://github.com/Hemanth2423/Learning-retention/pull/32), [#40 concept model and visual lessons](https://github.com/Hemanth2423/Learning-retention/pull/40), [#44 adaptive checks](https://github.com/Hemanth2423/Learning-retention/pull/44).
- **My original prompt** (my first message to the agent, paraphrased in [prompts/quizzes.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/quizzes.md)):

  > For each chapter we can have a short test and that can be recorded as a concept check progress

- **The agent's response, where it went sideways** ([prompts/topic-breakdown.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/topic-breakdown.md)):

  > Per topic, in parallel: Firecrawl web search → DeepSeek picks up to 2 real examples from those search results and writes a 5-question quiz grounded in the source.

  and the instruction the agent wrote for DeepSeek (convex/ai.ts in PR #12):

  > Exactly 5 quiz questions grounded in the SOURCE.

- **What came out** (first real end to end run, Nov 4): questions like *What does encoding do, according to the source?* with right answers in the order A, B, C, D ([prompts/fix-quiz-shuffle.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/fix-quiz-shuffle.md)).
- **Devi's feedback I passed to the agent:**

  > According to the source, what does the 'observe' step of the AI scientific-method loop actually involve? -> Who cares what the source says, we care about the actual conceptual understanding itself

- **My prompt that turned it around:**

  > What is the best way to plan out our reasoning system to ensure that we are able to create an adequate pedagogy, while keeping the costs on check (I definitely want to minimize per document token consumption)

- **The agent's response** (full design in [prompts/concept-lessons.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/concept-lessons.md) and [prompts/adaptive-checks.md](https://github.com/Hemanth2423/Learning-retention/blob/main/prompts/adaptive-checks.md)):

  > In short, the AI reads the document carefully once, and every later step works from a compact summary of the ideas instead of the whole document.

---

## 2. The stranger test

I gave the live app to my partner Devi, who is not in this class, and watched without helping. Devi made an account, uploaded a real document and used it for about ten minutes while I noted every pause.

### Top 3 struggles

1. **Getting a PDF in.** The file picker looked like any other form field, so Devi wasn't sure where the upload actually was. Then the required Subject field stopped things. For a guide that isn't from a class, a subject didn't mean anything, and Devi had to make one up just to continue.
2. **The mind map.** Every node was open at once and it followed the document's sections, so it read like a table of contents. Devi wanted to see the core building blocks first and then go deeper, the way NotebookLM does it, and sent me a screenshot as a reference.
3. **The content and the questions.** The key points felt bland, nothing you could learn from instead of reading the book, and the quiz asked what the source said rather than whether the idea made sense. Devi stopped trying to answer them properly.

### The one I fixed first: the upload ([PR #38](https://github.com/Hemanth2423/Learning-retention/pull/38))

I picked the upload because it's the front door. If you can't get a PDF in, none of the other features exist for you. Struggles 2 and 3 matter more for learning, but they only happen after a successful upload, and they were also part of the bigger plan gap in question 1, which needed a redesign rather than a quick fix. The upload was a clear, contained problem.

The fix is a large drop zone with a round (+) at the top of the form. You can click it or drag a PDF onto it, and it shows the file name once it's in. Subject is now optional in the form and in the server validation. I checked it in the browser: an empty form only asks for a title and a PDF, and a dragged file gets picked up.

I fixed the other two after that, the map in [PR #42](https://github.com/Hemanth2423/Learning-retention/pull/42) and the lessons and questions in [PR #40](https://github.com/Hemanth2423/Learning-retention/pull/40) and [PR #44](https://github.com/Hemanth2423/Learning-retention/pull/44).

### What I decided not to fix, and why

**Wait time.** The first map takes about a minute and a half, because a stronger reasoning model reads the whole PDF, and each new lesson takes 20 to 40 seconds. I could make it faster with a cheaper model or less reasoning. But the concept model is what everything else depends on, and I would rather wait a minute than get a table of contents again. Building the next lesson in the background already hides most of the lesson wait.

**Smaller gaps.** Scanned PDFs aren't supported (the app says so clearly), the top nav is cramped on a phone, and teach-back is still V2.

I think that's the right tradeoff for now because these are about speed and polish, not about whether a stranger can get value out of the app. With the demo today, I'd rather show something that teaches well and is a bit slow than something fast that teaches badly.
