# Send my book notes to Notion

**Status:** in review · **Branch:** `api/notion-export` · **Issue:** #77

As a reader, I want to send a book's chapter notes and highlights to a Notion page I choose, so that my learning lives with the rest of my knowledge.

## Acceptance criteria

- Connect my Notion workspace, choose a parent page, and send notes and highlights in chapter order.
- Edit a chapter note and send again. The same page updates, its link stays the same, and the last-sent time advances.
- If Notion access is removed, show **Reconnect Notion** and let me send again after reconnecting.

## Implementation and verification

Keep OAuth and Notion requests in Convex. Check book ownership before sending. Share the notebook builder and integration tables with Google Docs. Test repeated sends with mocked Notion responses, then check the flow with a test workspace and a real PDF.

## Status log

- **2026-11-22:** Checked in a real Notion workspace: connect, choose a page, send, then send again to the same page with a newer last-sent time. The first failure came from a wrong `NOTION_CLIENT_SECRET` on the dev deployment, not from the code.
- **Deviation:** a book with no notes or highlights gets one line ("No notes or highlights yet…") instead of a blank page, because a blank page looked like a failed send.
- **Not checked yet:** a send from a book that has real notes and highlights (covered by tests only), and the live deployment, which still needs the Notion env vars and a production redirect URI.
