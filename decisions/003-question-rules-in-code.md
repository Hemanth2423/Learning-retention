# 003. Question rules live in code, not prompts
**Date:** 2026-11-04 · **Status:** accepted

**Context:** The model kept writing "according to the source" questions, and the correct answers ran A, B, C, D in order.
**Decision:** `questionRules.ts` rejects source-mention questions, shuffles the options, grades on the server and hides answer keys from the browser. Prompts ask for good questions, and code guarantees them.
**Why:** Prompts are suggestions and code is a guarantee. Cost: some generated questions get thrown away.
