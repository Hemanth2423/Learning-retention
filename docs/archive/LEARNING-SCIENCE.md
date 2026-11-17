# Ingrain: the science we build on

This is the scientific philosophy behind Ingrain. Every feature should trace back to one of the principles below. If a feature can't, it's decoration.

## The one-paragraph version

Memory isn't a recording. It's a physical change in the brain that has to be built, and the brain only builds it for things that seem worth keeping. A first exposure creates a fragile, short-term trace. That trace turns into lasting memory only when it's **retrieved, spaced out over time, connected to what you already know, and slept on**. Effort during learning is the signal that tells the brain "keep this". Smooth, easy learning feels good and fades fast. So the app's job isn't to make learning feel easy. Its job is to make the *right* kind of hard feel doable, and fun.

## What the research says

### 1. There are different kinds of memory, and we're building one: declarative
*Squire & Dede, "Conscious and Unconscious Memory Systems" (2015)*

- **Working memory** holds a few items for seconds. When it's overloaded, learning stalls.
- **Declarative memory** (facts and concepts) depends on the hippocampus. It's *flexible*: you can use it in new situations, explain it, and combine it with other ideas. That flexibility is what "understanding" means.
- **Nondeclarative memory** (skills, habits) is built through repetition and isn't flexible.
- Declarative memory is relational. The hippocampus binds pieces together, so a concept is learned as part of a web of other concepts, not on its own.

**For Ingrain:** present one idea at a time (respect working memory), always show where it sits in the bigger map (relational binding), and test for flexible use in new situations, not recall of the original wording.

### 2. Short-term becomes long-term only through repetition over time
*Kandel, "The Molecular Biology of Memory Storage: A Dialogue Between Genes and Synapses" (Science, 2001)*

- Short-term memory is a temporary chemical change to existing synapses. It lasts minutes to hours.
- Long-term memory needs genes to switch on (via CREB), new proteins to be made, and **new synaptic connections to grow**. It's literally a structural change.
- What flips the switch from short to long term is **repeated, spaced stimulation**. In Kandel's experiments, five spaced pulses produced long-term change, while the same amount given all at once didn't.
- The brain also has active "memory suppressors": a default bias against storing things. Learning has to overcome it.

**For Ingrain:** one session never makes a memory. Coming back is the product. Each return visit is one of those spaced pulses.

### 3. Spacing is the most reliable lever we have
*Smolen, Zhang & Byrne, "The right time to learn: mechanisms and optimization of spaced learning" (Nature Reviews Neuroscience, 2016; arXiv 1606.08370)*

- Spaced practice beats massed practice (cramming) for long-term retention, across species and kinds of task.
- The benefit has a molecular basis: the signaling cascades that consolidate a memory take time to complete, and a new session lands best when the last one's cascade has peaked.
- Longer gaps generally help more than short ones, and model predictions suggest **irregular, expanding gaps** may beat a fixed schedule.

**For Ingrain:** schedule reviews at expanding intervals (e.g. 1 day, 3 days, 1 week, 3 weeks), adjusted per concept by how well you did. Don't make you review on a rigid calendar.

### 4. Sleep consolidates, and it keeps what seems relevant and the gist
*Rasch & Born, "About Sleep's Role in Memory" (Physiological Reviews, 2013)*

- New memories start in the hippocampus and are gradually moved to the neocortex for long-term storage, mainly during deep (slow-wave) sleep, when they're **replayed**.
- Sleep doesn't strengthen everything equally. It favors memories that were **learned explicitly and flagged as relevant for the future**. Telling people they'd be tested later boosted the sleep benefit.
- Replay favors what's common across experiences over specific details, so sleep helps extract **gist, schemas, and insight**.

**For Ingrain:** end every session by telling you what you'll be asked next time and why it matters (future-relevance tag). Teach the principle, not the trivia, since gist is what survives. The best time for a first review is the next day, after a night's sleep.

### 5. Struggle is the signal, but only the right kind
*Psychology Today, "Why Struggling the Right Way Helps You Learn" (2025), on Bjork's desirable difficulties*

- Easy learning is forgotten quickly. Effortful learning sticks.
- **Desirable difficulties** (testing yourself, spacing, interleaving, varying conditions) feel harder and make short-term performance look *worse*, which is why learners avoid them.
- The **illusion of learning**: in Deslauriers et al. (2019), students in active-learning classes learned more but *felt* they learned less than lecture students. Fluency feels like understanding but isn't.
- The difficulty has to be one you can overcome. Struggle you can't get through just makes you quit.

**For Ingrain:** make you think before showing the answer. Celebrate effort and recovery from mistakes, not just being right. Keep each challenge just within reach (adapt difficulty). Show you real evidence of progress, because your own feeling of how well it's going is unreliable.

### 6. What actually works: the evidence ranking
*Dunlosky et al., "Improving Students' Learning With Effective Learning Techniques" (2013)*

| Technique | Utility | What it means for us |
|---|---|---|
| **Practice testing** (retrieval) | High | The core loop. Works for every age, ability and material. Best with feedback. Recall beats recognition. |
| **Distributed practice** (spacing) | High | The review schedule. Optimal gap grows with how long you want to remember it. |
| **Elaborative interrogation** ("Why is this true?") | Moderate | Ask *why* constantly. Works better the more you already know. |
| **Self-explanation** (explain how it connects) | Moderate | Have you explain steps and links in your own words. |
| **Interleaved practice** (mix problem types) | Moderate | Mix questions across concepts so you learn *which* idea applies, not just how. |
| Summarization | Low | Helps only when done well. Don't rely on it. |
| Highlighting | Low | Feels productive, isn't. Don't build it. |
| Keyword mnemonic | Low | Narrow use, short-lived. Skip. |
| Imagery for text | Low | Limited. Diagrams *we* provide are different: they show structure. |
| Rereading | Low | The most common habit and one of the weakest. Replace it with testing. |

Notable details:
- Practice testing works even without feedback, but **feedback makes it much stronger**, and slightly delayed feedback can beat immediate feedback.
- **Free recall and short answers beat multiple choice** for long-term learning, because they demand more retrieval effort.
- Spacing and testing combine: **spaced retrieval** is the strongest single strategy in the review.

## The design rules these lead to

1. **Retrieve, don't reread.** Every lesson ends in active recall. There's no "mark as read".
2. **Space it.** Mastery isn't earned in one sitting. A concept is only *ingrained* after successful recall across spaced sessions.
3. **Ask why.** Every concept is taught through its *why*, and you're asked to explain why, not just what.
4. **One idea at a time, always inside the map.** Small chunks for working memory, constant zoom-out to show connections.
5. **Mix it up.** Reviews interleave concepts and question types so you learn to pick the right idea.
6. **Struggle within reach.** Make you guess or generate before revealing anything. Adapt difficulty so you get some right and some wrong.
7. **Use, don't recite.** Test transfer: new scenarios, edge cases, links between ideas. Never "according to the source".
8. **Feedback that teaches.** A wrong answer gets an explanation of the misconception, then a second chance later.
9. **Tag the future.** End each session by previewing what's next and why it matters. That's the cue sleep uses.
10. **Teach the gist.** Principles and schemas over details, because gist is what consolidation keeps.
11. **Trust data over feelings.** Show learners real retention (did you recall it after a week?), not just how confident they felt.
12. **Make return visits rewarding.** Since repetition over time is what builds memory, streaks, levels and badges are there to reward *coming back*, not cramming.

## Question variety, mapped to science

| Question type | Principle | Example |
|---|---|---|
| Predict first (before the lesson) | Pretesting, desirable difficulty | "What do you think happens to retention if you double the price?" |
| Free recall | Retrieval practice | "Name the four stages of the growth loop." |
| Why is this true? | Elaborative interrogation | "Why does activation come before retention?" |
| Explain it simply | Self-explanation | "Explain this to a friend in two sentences." (AI grades it against the rubric) |
| Apply to a new case | Transfer, flexible declarative memory | A scenario the book never mentions |
| Spot the misconception | Feedback, error correction | "A colleague says X. What's wrong?" |
| Connect two ideas | Relational binding, schemas | "How does idea A change the way idea B works?" |
| Order / sort / match | Structure, schema building | Drag steps into the right sequence |
| Which idea applies? | Interleaving | A mixed review where you choose the concept |
| Confidence rating | Calibration against the illusion of learning | "How sure are you?" before seeing the answer |

## Sources

1. Squire, L. R., & Dede, A. J. O. (2015). Conscious and unconscious memory systems. *Cold Spring Harbor Perspectives in Biology*, 7, a021667.
2. Kandel, E. R. (2001). The molecular biology of memory storage: A dialogue between genes and synapses. *Science*, 294, 1030–1038. (The page was blocked, so this summary is based on the paper's known findings and Kandel's Nobel lecture.)
3. Rasch, B., & Born, J. (2013). About sleep's role in memory. *Physiological Reviews*, 93, 681–766. (I read the open PMC copy, sections I to III.)
4. Smolen, P., Zhang, Y., & Byrne, J. H. (2016). The right time to learn: Mechanisms and optimization of spaced learning. *Nature Reviews Neuroscience*, 17, 77–88. arXiv:1606.08370.
5. Psychology Today, Curiosity Code blog (Apr 2025). Why struggling the right way helps you learn.
6. Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1), 4–58.
