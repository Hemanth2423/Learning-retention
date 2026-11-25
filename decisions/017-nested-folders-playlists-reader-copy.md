# 017. Nested folders, playlists as folders, and a cleaned reader copy
**Date:** 2026-11-22 · **Status:** accepted (Hemanth's UX round; extends ADRs 012 and 016)

**Context:** Filing needed to feel like adding songs to a playlist, folders needed to nest, playlists had no home, and saved articles included site buttons, counters and paywall text.
**Decision:**
- **Nested folders:** `folders.parentId`, 4 levels, names unique among siblings. Deleting a folder lifts its items and subfolders one level (a clashing name gets a number); `folders.restore` undoes it exactly. Cycles and too-deep moves are refused on the server.
- **Playlists become folders:** a playlist link uses the **YouTube Data API** (`YOUTUBE_API_KEY`, server only) to make a folder of up to 200 videos in order. `folders.playlistId` makes adding it again update the same folder. Videos already filed stay where they are.
- **Articles keep a reader copy** (what Readwise Reader, Matter and Instapaper do: highlights and notes need it; Firecrawl stays). `cleanArticleBlocks` removes site chrome **when reading**, so stored text never changes and older articles are cleaned without new credits. A paywalled post says it's a free preview.
- **Reader | Original:** the original page is embedded when its headers allow framing (`links.canEmbed` checks public hosts only and returns yes/no); otherwise it offers a new tab. Substack blocks framing.
**Why:** Each reuses what exists (folders, chunks, Firecrawl). Cost: one new API key; embedded originals can't be highlighted.
