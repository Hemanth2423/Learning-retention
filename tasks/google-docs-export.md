# Send my book notes to Google Docs

**Status:** in progress · **Branch:** `api/google-docs-export` · **Issue:** #78

## Why

- **User problem:** Readers can take useful notes and highlights in Ingrain, but cannot keep, share, or print them outside the app.
- **Outcome it serves:** A reader can move their learning into a familiar document they control without copying each chapter by hand.

## Acceptance criteria

"Done" means the reader's notes arrive in the same Google Doc safely and predictably.

- [ ] Given a signed-in reader with a book, when they connect Google, then OAuth uses the server-only `drive.file` scope and returns them to that book.
- [ ] Given a connected reader, when they send a book for the first time, then Ingrain creates or reuses an `Ingrain notes` folder and creates one Google Doc named after the book.
- [ ] Given notes and highlights in different chapters, when the reader sends the book, then the Doc lists chapters in book order and places each note, highlight, comment, and page number under the correct chapter.
- [ ] Given a book already sent to Google Docs, when the reader edits a note and sends again, then Ingrain updates the same Doc instead of creating a duplicate, keeps the same link, and advances the last-sent time.
- [ ] Given an expired access token with a valid refresh token, when the reader sends again, then Ingrain refreshes access on the server and completes the send.
- [ ] Given revoked Google access, when the reader sends again, then Ingrain shows **Reconnect Google** without losing their Ingrain notes.
- [ ] Given User B, when they try to use User A's Google connection or export User A's book, then the server refuses the operation.
- [ ] HTML-like text typed into a note is exported as text, never interpreted as markup.

## Design

- Add a **Send to Google Docs** control beside the existing Notion export on the book path page.
- Show connection state, last-sent time, an **Open in Google Docs** link, and plain-language reconnect/error messages.
- Reuse `convex/exportRules.ts` and the shared integration/export tables added by the Notion feature.

## Constraints

- **Cost:** Stay within the free standard Google Drive and Docs API quotas; do not attach Cloud billing.
- **Access:** Use only the non-sensitive `drive.file` scope. OAuth secrets and tokens stay in Convex server environment/storage and never appear in browser responses, logs, screenshots, prompts, or git.
- **Data:** Store only the server-side token data needed to reconnect, the per-user folder ID, the per-book Doc ID/link, and last-sent metadata.
- **Out of scope:** Reading changes back from Google Docs, broad public OAuth publication/verification, arbitrary document templates, or changing the Notion feature.
- **Schema:** Reuse the current schema. Any unexpected schema change requires Hemanth's approval, an architecture update, and an ADR before implementation.

## Relevant files

- `convex/exportRules.ts`
- `convex/exports.ts`
- `convex/schema.ts`
- `convex/http.ts`
- `convex/google.ts` and `convex/googleData.ts` (new)
- `convex/googleRules.ts` (new pure formatting/request rules)
- `components/export/SendToGoogleDocs.tsx` (new)
- `app/read/[id]/page.tsx`

## Verification

- [ ] **Required feature test:** A Chapter 2 note and a Chapter 1 highlight/comment export in Chapter 1 → Chapter 2 order; HTML-like note text remains text; the Doc ID/link are saved.
- [ ] **Update test:** Editing a note and sending again updates the original Doc and advances `lastSentAt` without creating another Doc.
- [ ] **Security test:** User B cannot use User A's integration or export User A's document.
- [ ] **Token test:** An expired access token refreshes; revoked refresh access returns **Reconnect Google**.
- [ ] `npm test` and `npm run lint` pass.
- [ ] Browser-check connect, first send, edit-and-send-again, open-link, and reconnect behavior with a real PDF and a Google test account.

## Status log

- 2026-11-24: Confirmed Notion PR #85 merged into `main`; shared tables, notebook builder, and server OAuth pattern are available. Baseline is 169 passing tests and 0 lint errors.
- 2026-11-24: Created the feature branch and wrote this specification before implementation. Google Cloud project, Drive API, Docs API, and external-testing consent configuration already exist; no OAuth client or secret has been created yet.
- 2026-11-24: Added pure Google Docs formatting and replacement-request rules. Targeted tests verify chapter order, highlight comments/page numbers, literal HTML-like note text, title/chapter styles, and replacement of an existing document body.
- 2026-11-24: Added the server-only Google OAuth and export backend. It requests only `drive.file`, keeps tokens out of browser responses, refreshes expired access, reconnects after revoked access, reuses the same Google Doc, and enforces book ownership.
- 2026-11-24: Backend verification is green: 175 tests in 36 files pass and full lint has 0 errors (22 pre-existing warnings). Convex code generation still requires access to Hemanth's deployment, so the new server functions temporarily use supported named function references; no generated file was edited by hand.
