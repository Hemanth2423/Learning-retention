# Prompt log: articles (Firecrawl) + YouTube by link

**Member:** @Hemanth2423 · **Agent:** Claude Code · **Issue:** #81 · **Branch:** `api/article-youtube-links`
Session opener: "Read PLAN.md and TEAM-PLAN.md. Today I'm building adding articles and YouTube videos by link." (The original PLAN.md is `docs/archive/PLAN.md`.)

## Key prompts and what came back

1. **"Yes, start slice 1"** (after the agent proposed re-ordering Feature 3 so the graded API feature ships first).
   Agent: opened issue #81 with the TEAM-PLAN user story, branched from `main`, and listed what the slice needed approved: a schema change (source type, URL, site, image, video id, a text locator) and one Markdown renderer.

2. **Checking the API before coding.** The agent made one real Firecrawl call on `paulgraham.com/greatwork.html` to see the actual response instead of trusting memory.
   Found: `data.markdown` + `data.metadata` (`title`, `statusCode`, no `ogImage` for this site); the Markdown starts with layout tables and spacer GIFs. So the tile needs a fallback image and the text needs cleaning.

3. **First browser check surprised us:** the article opened full of navigation images and stray `|` characters, and every line was its own paragraph.
   Agent's diagnosis: Paul Graham's layout rows don't end with `|`, so the table filter missed them; and Firecrawl turns every line break into `<br>`. It fetched the raw Markdown once more and found **zero** `<br><br>` pairs and 1,166 single `<br>`s: the paragraph breaks are lost at the source.
   Fix: take table rows apart before expanding `<br>`, and rebuild paragraphs from hard-wrapped lines (a short line ending a sentence closes a paragraph). Both fixes are tested on the real page's text (`convex/linkRules.test.ts`).

4. **Duplicate rule (the graded test).** "Given I already added an article link, when I add the same link again (with or without tracking parameters like `?utm_source=`), then I'm told it's already in my library and no second item is saved."
   Agent: the canonical link drops `www`, the hash, tracking parameters and trailing slashes (YouTube links become `watch?v=<id>`), and the duplicate check + insert happen in one transaction (`links.begin`), before any paid Firecrawl call. The test also checks Firecrawl is called only once.

## Where the key stays
`FIRECRAWL_API_KEY` is only in Convex environment variables (dev and prod) and read inside the `links.add` action. The browser calls `api.links.add` and never sees the key or talks to Firecrawl or YouTube's API directly.
