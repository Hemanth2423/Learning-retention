# Reflection

Each member's API story (200–300 words, with quoted prompts and a linked PR or commit), then a group section. Rules: [ASSIGNMENT.md](ASSIGNMENT.md).

## @abbystern: Notion export

The first time I tested Send to Notion, it looked like nothing happened. The button looked like plain text, and after I signed in to Notion I landed back on my book page with no message at all. So I asked Claude Code: "can you make the buttons have a hover so they look more like a button. and can you work on the send to notion button. it doesn't work"

I assumed the bug was in our code. It wasn't. The Convex logs showed Notion answering with HTTP 401, and a direct check came back `invalid_client`: the client secret saved in Convex didn't belong to our Notion integration. The fix was one command. Getting there took far longer, partly because I pasted the new secret twice and the second paste landed in plain text in my terminal. I refreshed the secret in Notion and set it again.

Notion is one of our two "hard mode" APIs because every reader signs in with OAuth, so the token and every Notion call stay in Convex. I started the feature with this prompt: "Today I'm building 'Send my book notes to Notion'. … Keep Notion calls and tokens on the server. Test that sending again updates the same page." That test matters most to me. It edits a note between two sends and checks that Ingrain updated the same Notion page instead of creating a second one.

Once connecting worked, my first real send made a blank page, because the book had no notes yet. A blank page looks exactly like a failure, so now the page says there is nothing to send yet.

What I learned: when an OAuth call fails, check the credentials before the code.

**Evidence:** [PR #85](https://github.com/Hemanth2423/Learning-retention/pull/85) · [commit dbd500a](https://github.com/Hemanth2423/Learning-retention/commit/dbd500a) · prompt log [prompts/notion-export.md](https://github.com/Hemanth2423/Learning-retention/blob/api/notion-export/prompts/notion-export.md)

## @Hemanth2423: Firecrawl + YouTube oEmbed

_To be written by Hemanth._

## @EEBarr14: Google Docs

_To be written by Erin._

## Group

### The two most important review comments

_To be written together._

### The hardest part of working in someone else's code

_To be written together._
