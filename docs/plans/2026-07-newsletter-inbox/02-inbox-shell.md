# Phase 2 — Inbox shell: router, sidebar, list, preview pane

**Goal:** the Meco-style inbox shell is live on `newsletter.zo-bot.com` — dark left
sidebar (Today / Unread / Starred / Archived + SOURCES), redesigned middle list,
right preview pane on wide screens, responsive collapse below 1024px. This is the
largest phase. The full-screen reader is only stubbed here; Phase 3 completes it.

**Where this runs:** repo `newsletter-app` (Windows). No VPS/nginx work. Phase 1 must
be deployed (this phase consumes `/api/counts` and `since=`).

Read first: `00-overview.md` (fully — especially locked decisions 3–5, the design
reference, and the API table), then the current `src/App.jsx` and
`src/components/*.jsx` to understand what you're replacing, and
`finance-app/src/utils.js` (the `apiUrl` pattern to copy).

## Preconditions

- Clean working tree; `npm run build` passes; Phase 1 endpoints respond in dev
  (`curl localhost:<port>/api/counts`).

## Steps

1. **Install `react-router-dom` (v7).** The only new dependency this program adds.

2. **`src/api.js`** — base-path plumbing (locked decision 4):

   ```js
   // Prefix an absolute path with the app's base path (import.meta.env.BASE_URL:
   // '/' in dev, '/newsletter/' in prod after the Phase 4 migration).
   export function apiUrl(path) {
     return import.meta.env.BASE_URL + path.replace(/^\//, '')
   }
   ```

   Every `fetch` in the rebuilt frontend goes through it. Before finishing, grep
   `src/` for `fetch('/` / `fetch("/` / `fetch(`/` — there must be zero bare absolute
   fetches left.

3. **Router.** In `src/main.jsx`, wrap the app in `<BrowserRouter basename={...}>`
   with exactly:

   ```js
   const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'
   ```

   (`'/'` now and in dev; `'/newsletter'` after Phase 4 — no code change needed
   then.) Routes:
   - `/` — the inbox (sidebar + list + preview). **URL is the source of truth** for
     inbox state via search params: `?filter=` (all|unread|starred|archived — same
     values as today, plus the new client-only `today`), `?sender=`, `?q=`. The
     existing `?filter=unread` deep link from the homepage must keep working
     identically.
   - `/read/:id` — full-screen reader **stub** for this phase: fetch the newsletter
     (default mark-read), render the sanitized `reader_html` in the same sandboxed
     iframe pattern (`sandbox="allow-same-origin allow-popups"`,
     `referrerPolicy="no-referrer"` — copy the attrs from the current
     `NewsletterReader.jsx`, change nothing about them this phase), with a minimal
     "← Back" that navigates to `/` preserving prior search params. Phase 3 replaces
     this stub wholesale — keep it simple.
   - "Today" maps to the API as `filter=all&since=<local-midnight-epoch-ms>`
     (compute midnight client-side with `new Date().setHours(0,0,0,0)`).

4. **`src/components/Sidebar.jsx`** (new). Persistent at `lg:` and up; drawer below
   (step 7).
   - Header: app name "Newsletters".
   - Nav items with counts from `GET /api/counts?since=<local midnight>`: **Today**
     (`today`), **Unread** (`unread`), **Starred**, **Archived**. Active item
     highlighted from the current search params.
   - **SOURCES** section from `GET /api/senders`: colored-initial avatar (extract the
     existing avatar logic from `NewsletterList.jsx` into a shared
     `SenderAvatar.jsx` — keep its color-hash behavior so avatar colors don't change),
     sender name, unread count badge. Show the top ~8 by total; a "View all sources"
     toggle expands the full list. Clicking a source sets `?sender=`; clicking it
     again (or an explicit ×) clears it.
   - Footer: the **Sync** button (reuse/restyle `SyncButton.jsx` — keep its 409
     handling) and **Mark all read** (existing `POST /api/newsletters/read-all` +
     the existing confirm-and-refresh behavior). Plus a plain home link to
     `https://zo-bot.com` replacing the current header house icon (Phase 4 repoints
     this to `/` and gates it to standalone mode — here it's just a visible link).
   - Counts refresh after any action that changes them (read/star/archive/sync/
     mark-all-read) — simplest correct approach: re-fetch `/api/counts` and
     `/api/senders` after mutations, keeping the existing optimistic list updates
     for the rows themselves.

5. **List pane** (rewrite `src/components/NewsletterList.jsx`).
   - Top: `SearchBar` (existing debounce-into-`q` flow, now writing `?q=`); "/"
     focuses the search box (unless already typing in an input), Esc clears/blurs.
   - Date-group headers — TODAY / YESTERDAY / weekday+date (extend the existing
     `groupByDate` helper).
   - Rows: avatar, sender name, subject (bold + blue dot when unread), snippet
     (1–2 lines, `line-clamp` — the `snippet` field is already in the list response,
     currently unused), relative time ("6m", "2h", date when older), star toggle,
     "N min read" label, archive affordance (keep it available as today — row hover
     or overflow). Selected row visibly highlighted.
   - Pagination: keep the existing 25/page prev/next controls and server contract.
   - Wide screens: clicking a row **selects** it into the preview pane (local state,
     not navigation). Narrow screens: clicking navigates to `/read/:id`.

6. **`src/components/PreviewPane.jsx`** (new, `lg:`+ only). The light reading card on
   the dark shell:
   - Header: avatar, sender name + email, date, "N min read"; actions: star, archive,
     mark-unread (`POST /:id/read {read:false}`), and an **expand** affordance that
     navigates to `/read/:id`.
   - Body: the sandboxed iframe with `reader_html` (same attrs as the current modal).
   - Selecting a row fetches `GET /api/newsletters/:id` (default mark-read — locked
     decision 5) and mirrors the existing optimistic updates: flip the row's
     `read_at`, decrement the unread counts.
   - Empty state when nothing is selected ("Select a newsletter to read").

7. **Responsive behavior.**
   - `lg:` (≥1024px): three panes — sidebar (~240px), list (~400px), preview (rest).
   - Below `lg:`: sidebar collapses behind a hamburger (drawer overlay); a horizontal
     filter-tab row (All / Today / Unread / Starred / Archived) appears above the
     full-width list; no preview pane; row tap → `/read/:id`.
   - **Test both sides of 1024px** — iPad Pro portrait is exactly 1024 logical px and
     must get the three-pane layout (Tailwind `lg:` is `min-width: 1024px`, so 1024
     is included; verify visually anyway).

8. **Rewrite `src/App.jsx`** as the layout shell + routes, keeping the data-fetching
   patterns (debounced `q`, page reset on filter change, optimistic updates) that
   already work. Delete dead code; keep `NewsletterReader.jsx` untouched and unused
   only if the stub reuses pieces of it — otherwise it is deleted in Phase 3, not
   here.

9. **Fix `CLAUDE.md`** (it is stale — see 00-overview): describe the real
   architecture (routes, three-pane shell, server FTS, router, `apiUrl`, dev port =
   whatever Vite prints).

## What NOT to do

- Nothing in `server/` — Phase 1 already landed the API.
- No Vite `base` change (Phase 4), no manifest/service-worker work (none is needed —
  locked decision 7).
- No categories, AI features, Read Later, TOC, progress bar, text-size control
  (locked decision 2).
- Don't change the iframe `sandbox` attributes (Phase 3 owns that, paired with the
  server-side `<base>` change).
- Don't change `PAGE_SIZE` or any endpoint.

## Verification

- `npm run build` passes.
- Dev walkthrough (`npm run dev`) at four widths (browser devtools responsive mode):
  ~1400, exactly 1024, ~678 (iPad split view), ~390 (iPhone). At each width confirm
  the layout matches step 7.
- Functional matrix (any width unless stated):
  - Each sidebar nav item shows the right count and filters the list; Today shows
    only today's items.
  - A source click filters + highlights; clearing works; "View all sources" expands.
  - Search: type → list filters via FTS; "/" focuses; Esc clears.
  - Pagination beyond page 1 works with a filter active.
  - Star/archive from row and preview; mark-unread from preview; mark-all-read;
    sync button (starts, completes or 409s gracefully).
  - Selecting a row (wide) marks it read: bold/dot clears, Unread count drops.
  - Narrow: tapping a row opens the reader stub full-screen; Back returns with
    filter/search state intact (URL search params preserved).
  - Deep link `http://localhost:<port>/?filter=unread` opens pre-filtered (homepage
    contract).
  - Browser back button from `/read/:id` returns to the list.
- Prod-entrypoint spot check: `npm run build`, `ALLOW_NO_ACCESS_HEADER=1 node
  server.js`, open `http://localhost:3002/`, click into `/read/:id`, **reload** —
  the SPA fallback must serve the app (nested route).
- Commit + push, `Deploy-Newsletter`, spot-check `https://newsletter.zo-bot.com` in
  the browser (filters, a preview read, a full-screen stub open).
- `node tools/ops-check.mjs` from the workspace root (CLAUDE.md edits shouldn't trip
  it — confirm).

## Rollback

Revert the commit + `Deploy-Newsletter`.

## Report

Append the Phase 2 report to `PROGRESS.md` (include per-width findings and any
deviations from the design reference) and update the status blockquote.
