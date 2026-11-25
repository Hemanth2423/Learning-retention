# Team Plan: Ingrain + APIs

**App:** Ingrain (owner @Hemanth2423) · **Team:** @Hemanth2423, @abbystern, @EEBarr14 · **Demo:** Wed Dec 2
The app's original plan is `docs/archive/PLAN.md` (left unchanged).

## 1. Pitch
We're adding **more ways in and more ways out** to **Ingrain**, a reading app that turns books into learning (notes, highlights, chapter tests), so that readers can learn from articles and talks as well as books, and keep what they learn in the tools they already use: **Notion** and **Google Docs**.

## 2. Who builds what
| Member | API | User story | Est. hours |
|---|---|---|---|
| @Hemanth2423 | Firecrawl + YouTube oEmbed | As a reader, I want to add an article or YouTube link to my library, so that I can read or watch it and take notes in the same place as my books. | 8 |
| @abbystern | Notion API | As a reader, I want to send a book's chapter notes and highlights to a Notion page I choose, so that my learning lives with the rest of my knowledge. | 10 |
| @EEBarr14 | Google Drive API (Docs) | As a reader, I want to send a book's chapter notes and highlights to a Google Doc in my Drive, so that I can keep, share and print my learning outside Ingrain. | 10 |

**Later (not graded):** Obsidian export (Obsidian has no cloud API; a Markdown download into the vault covers it).
**Hard mode:** Notion and Google Docs use OAuth (the user signs in). Flagged to the GSI before building.

## 3. APIs
All calls happen on the server (Convex actions and HTTP routes). Keys live in Convex environment variables, never in the browser or in git.

| Field | Firecrawl | YouTube oEmbed | Notion | Google Docs |
|---|---|---|---|---|
| API and docs | Firecrawl Scrape API, docs.firecrawl.dev | YouTube oEmbed (`youtube.com/oembed`), oembed.com; thumbnails at `i.ytimg.com` | Notion API (public integration, OAuth), developers.notion.com | Google Drive API v3 + Google Docs API v1 + OAuth 2.0, developers.google.com/workspace |
| What it gives us | An article's clean text (Markdown), title, site, preview image | A video's title, channel, thumbnail | A page in the user's workspace holding the book's notes and highlights | A Google Doc per book (notes and highlights) in an "Ingrain notes" folder |
| Key needed? | Yes (API key) | No | Yes: OAuth client ID and secret; each user signs in | Yes: OAuth client ID and client secret from a Google Cloud project; non-sensitive scope `drive.file` |
| Free limit | Limited free credits, 1 per page scraped (check current plan) | No published limit | Free; a few requests per second (check docs); 100 blocks per request | Free within Google's quotas; External Testing limits test users and refresh tokens may expire after 7 days (check current console) |
| Cost at 1,000 users | ~1 credit per article added; beyond the free credits a paid plan (check current pricing) | $0 | $0 | Expected $0 in direct API charges at normal usage within quotas |
| What we store vs fetch fresh | Store the text, title, site, image link once when added; never re-fetch | Store title, channel, thumbnail link when added; never re-fetch | Store token (server only), chosen parent page, created page ID and URL, last sent time; nothing is read back | Store the encrypted refresh token (server only), per-user folder ID, per-book Doc ID and link, and last sent time or export hash; nothing is read back |
| If it disappeared tomorrow | Already-added articles still open; new links are "saved as a link" | Videos still play (embed); new ones show the link as the title | Notes stay in Ingrain; Send shows "Notion isn't available" | Notes stay in Ingrain; Send shows "Google Docs isn't available" |

## 4. Database changes (Convex, `convex/schema.ts`)
| Feature | Change | Fields and types |
|---|---|---|
| Articles + YouTube | `documents`: new optional columns | `sourceType`: `"pdf" \| "article" \| "video"` (extends today's `"pdf"`), `sourceUrl`: string, `siteName`: string, `imageUrl`: string, `videoId`: string |
| Articles | article text | stored as `chunks` (existing table) so Ask and highlights work; full Markdown in file storage, `documents.contentId`: id of `_storage` |
| Notion + Google Docs (shared) | new table `integrations` | `userId`: id users, `provider`: `"notion" \| "google"`, `accessToken`: string, `refreshToken`: optional string, `expiresAt`: optional number, `accountName`: string · index `[userId, provider]` |
| Notion + Google Docs (shared) | new table `oauthStates` | `state`: string, `userId`: id users, `provider`: `"notion" \| "google"`, `returnTo`: string · index `[state]` (deleted once used or after 10 min) |
| Notion + Google Docs (shared) | new table `exportTargets` | `userId`: id users, `documentId`: id documents, `provider`: `"notion" \| "google"`, `parentId`: string, `remoteId`: string, `url`: string, `lastSentAt`: number · index `[documentId, provider]` |

The two export features share these three tables and one pure builder, `convex/exportRules.ts` (book → chapters with notes and highlights). Whoever merges first adds them; the other reuses them.

## 5. Tests
| Member | Test |
|---|---|
| @Hemanth2423 | Given I already added an article link, when I add the same link again (with or without tracking parameters like `?utm_source=`), then I'm told it's already in my library and no second item is saved. |
| @abbystern | Given I already sent a book to Notion once, when I edit a chapter note and press Send again, then Ingrain updates the same Notion page (no new page is created), the saved page ID and link stay the same, and the last-sent time moves forward. |
| @EEBarr14 | Given a book with a note on Chapter 2 and a highlight with a comment on Chapter 1, when I send it to Google Docs, then the uploaded document has Chapter 1 before Chapter 2, the highlight and comment under Chapter 1, any HTML typed in a note shown as text, and Ingrain saves the Doc ID and link for that book. |

Each test mocks the API's answer and checks what Ingrain does with it (what it saves or refuses), not whether the API works.

## 6. Done when
| Feature | Main path | Edge case |
|---|---|---|
| Articles + YouTube | Paste an article link: it appears in the library with its title, site and image, opens as readable text, and takes notes and Ask. Paste a YouTube link: it appears with its thumbnail and plays embedded beside notes. | A paywalled article (no readable text) is saved as a link with a clear message, no crash; a private or deleted video shows "This video isn't available" and nothing is saved. |
| Notion | Connect Notion, pick a page, Send: a page with the book title appears with each chapter's note and highlights. Edit a note, Send again: the same page updates. | Remove the integration's access in Notion, then Send: Ingrain shows "Reconnect Notion"; after reconnecting, Send works again. |
| Google Docs | Connect Google, Send: a Doc named after the book appears in "Ingrain notes" with chapters in book order. Edit a note, Send again: the same Doc updates. | With an expired access token, Send refreshes it and still works; if the refresh token is revoked, Ingrain shows "Reconnect Google". |

## Plan vs. Reality
Filled in at the end. Don't rewrite the plan above.

| Member | API feature | Shipped / Changed / Cut | Est. hrs | Actual hrs | Reviews given | What changed and why (one line) |
|---|---|---|---|---|---|---|
| @Hemanth2423 | Articles (Firecrawl) + YouTube | | 8 | | | |
| @abbystern | Notion export | | 10 | | | |
| @EEBarr14 | Google Docs export | | 10 | | | |
