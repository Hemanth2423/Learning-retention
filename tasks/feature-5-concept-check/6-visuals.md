# Part 6: Book visuals in questions
**Status:** proposal, not approved. **Why it matters:** in the System Design book, 147 of 269 pages carry a figure caption (190 figures). Today the model sees only text, so it cannot ask about them.

| Level | What the reader gets | How | New model? | Recommendation |
|---|---|---|---|---|
| **1. Code in questions** | Real snippet, shown in monospace | Model quotes it; code verifies it exists on the page | No | **V1** |
| **2. Figure in feedback** | The real figure beside the explanation | Crop the cited page in the browser with pdf.js | No | **V1** |
| **3. Questions built on a figure** | "Where does this design fail?" with the diagram | A vision model reads the crop and writes the question | **Yes** | **After a small spike** |

## Design rules
- **Never generate or redraw a figure.** Only show the reader's own uploaded source.
- **Store a location, not an image:** `{page, box}`. The browser renders it from the file, so there is no extra storage.
- **A question can only depend on a figure a model actually saw.** Otherwise the answer can't be trusted.
- **Find figures** from PDF image positions plus nearby "Figure 4-3" captions. Vector diagrams need the caption route.
- **Fallback:** if the crop fails, withhold a figure question. Feedback falls back to the page link.
- **V1 scope:** PDFs. EPUB, Word and slide images come later.

## Level 3 spike, before any build
- Choose a vision model, which needs Hemanth's approval under AGENTS.md.
- Test about 10 figures: diagrams, charts and tables.
- Pass if at least 90% of answers are supported by the figure, with cost per figure measured.
