# Part 7: Concept map, over time, and the Dashboard
**Status:** approved by Hemanth on 2026-11-24. **Design reference:** mockup 007 (screens 3–5). **Core outcome:** readers see what they know and what to do next (PRODUCT.md).

## What the reader gets
| Screen | What it shows | Rule kept from Part 1 |
|---|---|---|
| **Where you stand** | Three level cards, a colour grid of ideas × levels, confidence, next check | No percentages. Not checked is hatched, never red |
| **Concept map** | Ideas as nodes, joined by typed links. Fill = highest level reached, ring = how solid. Click a node for its detail | Faded = not checked |
| **Over time** | Ideas solid per level after each session, and what's been tested so far | Counts, not percentages |
| **Top nav** | Library · Dashboard · Settings, with streak and XP | |
| **Dashboard** | **Reading:** pages, chapters, notes, highlights per book and chapter. **Testing:** answers, ideas solid, activity, per-chapter levels | |
| **Settings** | Account, time zone, Notion connection, sign out | |

## Links come from an ontology, not free text
- **Each link is a property** `{from, to, type, note}`. `type` must be one of 7 relations taken from standard vocabularies:

| type | Shown as | Source |
|---|---|---|
| `is_a` | is a kind of | RDFS `subClassOf`, SKOS `broader` |
| `part_of` | is part of | OBO RO `part_of` (BFO_0000050) |
| `causes` | causes | OBO RO `causally upstream of` (RO_0002411) |
| `enables` | makes possible | OBO RO `enables` |
| `requires` | depends on | OBO RO `has prerequisite` |
| `precedes` | comes before | BFO `precedes` (BFO_0000063) |
| `contrasts` | contrasts with | SKOS `related`, narrowed to opposition |

- **Code enforces it:** unknown ideas, self-links, duplicates and unknown types are dropped. At most 8 links.
- **One small call per check** after the first batch (chapter text plus the ideas). Older checks get links the first time the map opens. One try per check, plus one retry.
- **Layout:** `d3-force` (ISC licence, pinned 3.0.0), run to a fixed number of steps so the map doesn't move.

## Acceptance criteria
- [ ] The map shows typed links with plain labels. Clicking or pressing Enter on a node shows its levels, links and page.
- [ ] Bad links never reach the screen (unit tests).
- [ ] Over time shows one point per finished session. With no sessions, it says what to do.
- [ ] The Dashboard's Reading and Testing tabs match the data in the library and concept checks.
- [ ] Works at 375 px. Sign out still works.

## Out of scope
Book-wide concept map across chapters, reading time (not tracked), and cross-book links.
