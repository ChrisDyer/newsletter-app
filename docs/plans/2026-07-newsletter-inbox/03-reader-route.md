# Phase 3 — Full-screen reader route

**Goal:** `/read/:id` becomes the immersive reader — light full-viewport reading
surface, complete toolbar, prev/next with prefetch, keyboard + swipe — and the old
modal (`NewsletterReader.jsx`) is deleted. Includes the one server-side change of the
UI phases: making links inside newsletters open properly in new tabs.

**Where this runs:** repo `newsletter-app` (Windows). No VPS/nginx work. Phases 1–2
must be deployed.

Read first: `00-overview.md` (locked decisions 2, 5; risk 4), the Phase 2 reader stub
and `PreviewPane.jsx`, the old `src/components/NewsletterReader.jsx` (port its
keyboard/swipe handlers before deleting it), and `server/readability.js`
(`toReaderHtml`).

## Preconditions

- Clean working tree; `npm run build` passes; Phase 2 shell works in dev.

## Steps

1. **`src/components/ReaderPage.jsx`** — replace the Phase 2 stub. Full-viewport
   light reading surface (white/near-white card, centered measure, comfortable
   reading typography — the visual flip from the dark shell is intentional).
   Top toolbar:
   - **← Back to newsletters** — `navigate(-1)` when there's history, else `/`
     (cold deep link). Returning must restore the list's filter/search/scroll state
     (search params already carry filter/search from Phase 2).
   - **Archive / Restore** (label reflects state), **Star**, **Mark unread**
     (marks unread then navigates back — matching inbox convention).
   - **Original ↗** — opens the Gmail permalink
     `https://mail.google.com/mail/u/0/#all/<gmail_id>` in a new tab. Best-effort:
     Gmail's fragment permalinks aren't contractual; if it proves flaky, note it in
     the report rather than engineering around it.
   - Sender header beneath: avatar, name, email, date, "N min read".

2. **Prev/next.** Carry the current list's ordered ids into the reader via router
   navigation state (`navigate(`/read/${id}`, { state: { ids } })`) from both the
   list (narrow) and the preview-pane expand (wide). In the reader:
   - Show ‹ / › controls when ids are present; hide them on a cold deep link (no
     state).
   - **Prefetch adjacent items with `?mark_read=0`** (this is why Phase 1 built it);
     cache the two neighbors in memory. Mark read only when an item is actually
     displayed (the default `GET /:id` on display does this — locked decision 5).
     If a prefetched neighbor is then displayed, still fire the mark-read (a plain
     `POST /:id/read` is fine — don't refetch the body).
   - Navigating prev/next replaces the route (`navigate(..., { replace: true,
     state })`) so Back returns to the list, not through every read item.

3. **Keyboard + touch.** Esc → back; ← / → → prev/next. Port the modal's touch-swipe
   handlers (60px horizontal delta threshold) onto the reader surface. Remove the
   listeners on unmount.

4. **Link behavior — paired change (risk 4, must land in the same commit):**
   - `server/readability.js` `toReaderHtml()`: add `<base target="_blank">` inside
     the generated `<head>`.
   - Everywhere the `reader_html` iframe is rendered (ReaderPage **and**
     PreviewPane): `sandbox="allow-same-origin allow-popups
     allow-popups-to-escape-sandbox"`. Without the escape flag, popup tabs inherit
     the sandbox and open with JavaScript disabled.
   - Keep `referrerPolicy="no-referrer"` and do **not** add `allow-scripts`.

5. **Delete `src/components/NewsletterReader.jsx`** and every reference. The modal is
   gone; `/read/:id` is the only reader. Grep for leftover imports.

6. Update `CLAUDE.md` if Phase 2's rewrite didn't already describe the reader route
   accurately.

## What NOT to do

- No `server/routes.js` changes. No Vite `base` change. No shell redesign.
- No TOC, progress bar, text-size control, AI anything (locked decision 2).
- Don't keep the modal around "just in case".
- Don't mark prefetched neighbors read (the whole point of `mark_read=0`).

## Verification

- `npm run build` passes.
- Dev walkthrough:
  - Wide: select in preview → expand → full-screen reader → Back returns to the same
    filter/scroll.
  - Narrow (~390px): tap row → reader → Back.
  - Prev/next: arrows, ← / → keys, and swipe all navigate; **neighbors stay unread
    until viewed** (open reader on item A with unread neighbor B: B keeps its dot in
    the list until you actually navigate to it — verify via `/api/newsletters?filter=unread`).
  - Toolbar: star, archive (item leaves non-archived filters after back), mark
    unread (returns, row shows unread again), Original opens Gmail in a new tab.
  - A link **inside** a newsletter body opens in a new tab and that tab is fully
    functional (JS runs — this proves the sandbox-escape pair).
  - Esc closes the reader.
- Prod-entrypoint deep-link test: `npm run build`,
  `ALLOW_NO_ACCESS_HEADER=1 node server.js`, load
  `http://localhost:3002/read/<id>` directly (cold — no prev/next expected, Back
  goes to `/`), and reload it (SPA fallback for nested paths).
- Commit + push, `Deploy-Newsletter`, spot-check the deployed reader (one full
  read-flow on the subdomain).
- `node tools/ops-check.mjs` from the workspace root.

## Rollback

Revert the commit + `Deploy-Newsletter` (restores the modal and the old
`toReaderHtml`).

## Report

Append the Phase 3 report to `PROGRESS.md` (note the Gmail-permalink behavior you
observed and the prefetch/unread evidence) and update the status blockquote.
