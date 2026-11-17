# 004. Source-agnostic documents with locators
**Date:** 2026-11-14 · **Status:** accepted (schema approved 2026-11-14)

**Context:** The MVP reads only PDFs, but links, YouTube and other formats are planned.
**Decision:** Model a **document** made of **chunks** and **sections**, each pointing at a **locator** (a tagged union, `{kind:"pdf", page}` today). Highlights, reflections and citations store locators. Each format is an adapter in `convex/sources/` that returns the same shape.
**Why:** New formats then add one adapter and one locator kind; the panels, chat and search stay as they are. Cost: a little more abstraction than a PDF-only model.
