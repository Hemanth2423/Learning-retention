# 001. Convex for backend, database, storage and auth
**Date:** 2026-11-03 · **Status:** accepted

**Context:** A solo builder needs a database, file uploads, logins and background AI jobs without running servers.
**Decision:** Convex covers all four: tables, file storage, Convex Auth (email + password) and scheduled actions. Next.js on Vercel is only the UI.
**Why:** One service, live queries for free and typed functions end to end. Cost: we're tied to Convex's model (no SQL, and AI calls only inside actions).
