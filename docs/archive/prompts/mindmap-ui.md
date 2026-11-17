# Prompt log: Concept map UI (NotebookLM style)

## The prompt (from Devi's test)

> Mindmap UI can be made more intuitive, e.g. add a (+) icon to expand each tree. The default will just be
> 1 open and people go deeper by clicking on each. I have added a reference UI. *(NotebookLM mind map screenshot)*

## What was built

`components/MindMap.tsx` is a custom React + SVG concept map that replaced markmap:
- **Data:** the reasoned concept model from the previous PR (course → pillars → sub-ideas → finer points),
  read from `topics.listByCourse`. There is no separate markdown outline any more, so `ai.ts` no longer generates one.
- **Starts with one level open** (the pillars). Each node with children has a **(+)/(−)** button, and you go
  one level deeper per click. "Expand all" and "Collapse" sit in the header.
- **Pill nodes and curved connectors** like the reference, colored by depth (ink root, amber pillars, green sub-ideas,
  muted details). Clicking a **pillar's name opens its lesson**.
- **Layout:** each visible leaf gets a row, and each parent is centered on its children. Column widths come from
  measuring the labels. Wide maps scroll sideways inside the card.
- Removed the `markmap-lib` and `markmap-view` dependencies.

## Bugs caught

- **Labels were cut off** ("Encodi…"). The canvas measured text in "Inter", but next/font gives Inter a generated
  family name, so the browser measured a fallback font. It now measures with the body's computed font family.
- **Curves and nodes didn't line up while expanding.** Nodes animated their position but the SVG curves jumped
  instantly. I removed the animation, so they always match.

## Verification

In the browser: the map opens with 5 pillars. (+) on "Working Memory" shows its 3 sub-ideas, and (+) again
shows the finer points. The parent is centered on its children, and the curves meet each node.
Lint shows 0 errors, `npm test` passes, and the build passes.
