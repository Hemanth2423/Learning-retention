# Part 1: Experience

## Entry points
- **Chapter path and end of chapter** use the existing `Test yourself` action. No new navigation.
- **Main action, in priority order:** Continue session → Review due → Start → Practice again.
- **Old test score** stays visible, labelled separately, with **Go deeper**. It never converts into the grid, because it measured something different.

## Screen 1: Overview
```
Chapter 1: How Habits Form
Reliable recall on 3 of 4 ideas. Application is your next step.

            Remember   Understand   Apply         Analyze
Cue         Solid      Solid        Shaky         Not checked
Craving     Solid      Shaky        Not checked   Not checked
Response    Solid      Needs practice  Not checked Not checked
Reward      Shaky      Not checked  Not checked   Not checked

[ Review 8 questions ]                 Practice my misses
About 6 minutes · Last checked Tuesday
```
- **First visit copy:** "Check the chapter's key ideas. You'll start with a mix of remembering and using them."
- **Summary lines appear only when evidence covers most ideas.** Otherwise: "2 of 4 ideas checked so far."
- **Practice my misses** appears only once misses exist. It is targeted practice, not a full check.
- **Phone:** one card per idea with four labelled rows.
- **Bloom and DOK** live behind **How this works**.

## Screen 2: Question
```
Question 3 of 8
APPLY · Predict the outcome

A friend always snacks while watching TV...
( ) option   ( ) option   ( ) option   ( ) option

How sure are you?  [Sure] [Think so] [Guessing]
Honest uncertainty helps us choose your next practice.
```
1. Choose an option.
2. Tap confidence, which submits.
3. See short feedback, the source quote and link. **Why?** expands the fuller explanation and why the chosen option tempts people.
4. Press **Next**.

**Decisions**
- **Show the mode, hide the idea until feedback.** The reader knows what kind of thinking is tested, but the idea's name can't give away the answer.
- **Challenge language by mode:** "Choose the best explanation", "Predict the outcome", "Diagnose the failure".
- **Confidence before result,** so it reflects the reader's belief rather than the feedback.
- **Immediate feedback** is a UX choice: corrective feedback is what the evidence supports, and it keeps a 6-minute session self-contained.
- **No hearts or fail state.** Harder questions should never feel punishing.
- **Report a problem:** wrong answer, ambiguous options, unsupported explanation, broken source. A reported question leaves that reader's bank and stops counting.

## Screen 3: Session result
- **A concrete headline:** "You used Cue correctly in a new situation."
- **Only what changed**, the next check date, and small XP.
- **Confident errors, neutrally:** "Worth revisiting: you felt sure rewards trigger habits. This chapter separates the trigger from the outcome."
- **Save to notes** stores the corrected idea and source, not only the missed question.

## Screen 4: Where you stand
| View | Shows | Example |
|---|---|---|
| **By mode** | Ideas with consistent evidence, of ideas in the chapter | "Remember: 3 of 4 ideas" |
| **By cell** | Status, recent checks, last checked | "Shaky · 2 of 3 recent · Tue" |
| **Needs practice** | Missed ideas, with source | "Craving: how it differs from a cue" |
| **Not checked** | Separate from gaps | "Not checked yet: Reward (Analyze)" |
| **Confidence** | Raw counts only | "Correct on 4 of 5 Sure answers so far" |
| **Coverage** | How much text was used | "Based on 28 of 40 pages" |

- **No percentages anywhere.** Adaptive questions change in difficulty, so a falling percent could simply mean harder questions.
- **Solid never expires silently.** It shows "Last checked" and "Due for a check".
- **Definition, one tap away:** "Solid means consistent success on spaced checks of this idea and mode. It isn't certified mastery."

## States and edge cases
| Situation | Behaviour |
|---|---|
| One meaningful idea | Shorter concept check |
| No testable idea, or too little text | Use the current 5-question test |
| Video or scanned PDF | Not offered |
| AI fails | Plain error and Try again, within the failure cap |
| Daily AI limit reached | Show reset time. Existing questions still work |
| Leave mid-session | Resume the same question, including its feedback if already answered |
| Two tabs | First answer wins. The other tab shows that result |
| Same-day practice | Allowed, with feedback. "Come back tomorrow to strengthen this" |
| Nothing is due | **Practice anyway** |
| No fresh scenarios left | "You've used this chapter's new scenarios. Repeats still help memory but don't count as new-situation evidence." |
| Fewer than 8 useful questions | End early and say why |
| Long chapter | State the coverage shown above |
| Source check fails | Withhold the question |
| Delete the book | All concept data is removed |
| Accessibility | Keyboard answers; statuses are text, never colour alone |
