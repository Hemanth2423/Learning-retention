# Part 5: Response to the external review
The review saw the spec, not the repo. Almost all of it improved the spec.

## Accepted
| Feedback | Change |
|---|---|
| "80% recalled" overclaims | Evidence counts; **no percentages** |
| Opening rules contradict "no locks" | All modes available; gates removed |
| 14 days doesn't make a scenario new | Practice, retention and transfer separated |
| Bank and session constraints | Sessions can be shorter; coverage rules defined |
| Validation only checks structure | Source quotes, quality gate by mode, reporting |
| Last-two rule can be overwritten | "Since the last miss" |
| Correct guess is weak evidence | Weak result added |
| 6% guess rationale | Removed |
| Solid can look current forever | Last checked and due shown |
| Scheduling undefined | Defined per idea and mode |
| Backend contracts | Duplicate, race, resume and stale-save rules added |
| Slice order | Spike and simulation come first |
| Metrics mixed | Classified, with denominators |

## Where I disagreed
| Review said | My position | Why |
|---|---|---|
| Use elapsed time **and** time zone | **Elapsed time only (20 hours)** | One rule closes midnight and travel loopholes. Time zone is only for display |
| Store `rulesVersion` | **Don't, for now** | Status isn't stored, so nothing can go stale. Awards are already preserved. Prompt version and model are stored because generated content can't be recomputed |
| Add stable option IDs | **Use the stored index** | Options are immutable after saving, so the index already is a stable ID |
| Preserve source-specific prerequisites | **Defer** | It needs an AI-built dependency map with its own error risk. Ideas keep chapter order instead |
| Review 100–150 questions, two reviewers, before build | **Stage it: 60 now, 100–150 before public beta** | Finding systematic failures needs far fewer. The full review belongs before real users, and the demo is Dec 2 |
| 90% mode agreement now | **85% for the spike, 90% for beta** | Key validity stays at 95%, since a wrong key damages trust more than a borderline mode |
| Hide idea only when it reveals the answer | **Always hide until feedback** | Detecting "reveals" is unreliable. One rule is simpler and safer |
| Show percentages with denominators | **Counts only** | Even "2/3 (67%)" looks more precise than it is |

## Went further than the review
- **Renamed modes** to Remember and Understand, since multiple choice shows recognition, not free recall or written explanation.
- **XP ledger risk:** `learnerStats.awarded` grows without limit. Concept XP uses bounded data instead.
- **Cap bug:** `summaryPassages` can exceed 30,000 characters on chapters over 100 pages.
- **Failure cost cap:** refunds restore the reader's allowance but not provider cost, so failed tries are limited.
