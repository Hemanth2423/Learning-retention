# 018. A hard daily budget for the YouTube Data API
**Date:** 2026-11-22 · **Status:** accepted (Hemanth: keep usage under 10% of the limits)

**Context:** Playlists use the YouTube Data API, whose default quota is 10,000 units a day, shared by the whole app.
**Decision:**
- New `apiUsage` table counts units per day (Pacific, when Google resets), for the app (`scope: "all"`) and per reader.
- **Caps:** 1,000 units a day for the app (10%), 50 per reader. A playlist costs 1 unit + 1 per 50 videos, at most 5.
- Before any call, `links.reserveYoutube` holds the maximum (5) in one transaction, so parallel adds can't overshoot. Unused units are returned afterwards. Failed calls still count, because Google charges for them. A crash keeps the hold, erring toward counting more.
- At a cap, the reader gets a plain message and YouTube is not called.
**Why:** A limit in code holds regardless of traffic or bugs. Cost: one small table. A quota cap in Google Cloud is a recommended second backstop.
