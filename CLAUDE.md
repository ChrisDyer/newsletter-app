# newsletter-app

Newsletter reader for the Gmail `Newsletters` label. The app is deployed at `https://newsletter.zo-bot.com/`; old `https://zo-bot.com/newsletter/*` redirects here with reader paths and query strings preserved. Cloudflare Access presents a login redirect on the public hostname (verified 2026-11-01); the origin rejects missing identity headers.

## Stack

React 19 + Vite 6 + Tailwind CSS v4 frontend, with `react-router-dom` v7. Express 5 runs as the production server and as a Vite middleware plugin in dev. SQLite uses `better-sqlite3` at `data/newsletters.db`.

## Commands

```bash
npm run dev          # Start Vite dev server; use the Local URL Vite prints
npm run build        # Production build into dist/
npm start            # Start the production Express server
npm run oauth-setup  # One-time Gmail refresh token setup
```

Vite does not pin a dev port in `vite.config.js`; do not assume 5174. It is usually 5173 when free. Production and dev builds use `base: '/'`.

## Frontend Architecture

`src/main.jsx` wraps the app in `BrowserRouter` with a basename derived from `import.meta.env.BASE_URL`:

```js
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'
```

Routes:

- `/` renders the inbox shell.
- `/read/:id` renders the full-screen light reader with toolbar actions, Gmail Original link, keyboard/touch navigation, and router-state prev/next.

Inbox state lives in URL search params, not local-only state:

- `filter=all|today|unread|starred|archived`; omitted means `all`.
- `sender=<from_email>` filters by sender.
- `q=<text>` uses server-side FTS.

The existing homepage deep link `?filter=unread` must keep working. The client-only `today` filter is translated to `GET /api/newsletters?since=<local-midnight-epoch-ms>`.

Every frontend fetch must go through `src/api.js` `apiUrl(path)`, which prefixes `import.meta.env.BASE_URL`. There should be no bare `fetch('/api/...')` calls in `src/`.

## UI

The current UI is a site-wide aligned light workspace with a local Newsletter adapter:

- Desktop uses the navy sidebar with the independent Newsletters identity at the top, followed by local Today/Unread/Starred/Archived counts from `/api/counts`, sender sources from `/api/senders`, Sync, and Mark all read.
- Mobile uses a white header with the Newsletters identity. Local filters remain in the inbox tabs/drawer and are separate from global app switching.
- The full-screen reader keeps the compact Newsletters identity in its toolbar.
- The list pane keeps search, date groups, snippets, unread dots, star/archive controls, read-time labels, selected highlight, and the existing 25/page server pagination.
- The light preview pane remains at `lg` and up. Selecting a newsletter fetches `GET /api/newsletters/:id`, which marks it read by design. Preview actions support star, archive/restore, mark unread, and expand to `/read/:id` with current list ids in router state.
- Below `lg` (under 1024px), there is no preview pane and tapping a row navigates to `/read/:id`.

Do not add categories, AI features, Read Later, a TOC, progress bar, or text-size controls for this program.

## Backend Architecture

`server/plugin.js` creates the Express app for Vite dev middleware. `server.js` serves production static assets and registers the same API routes.

Key files:

- `server/gmail.js` - OAuth2 client, Gmail API calls, MIME body extraction.
- `server/sync.js` - fetches message IDs for the label, skips existing rows, inserts new newsletters.
- `server/routes.js` - API routes, server-side FTS search, counts, sender counts, read/star/archive state changes, and sync.
- `server/readability.js` - sanitizes newsletter HTML for iframe rendering.

Current API shape is defined by `server/routes.js`; trust it over stale notes elsewhere. `GET /api/me` returns the Cloudflare Access email and `readOnly` role. `GET /api/newsletters/:id` marks the newsletter read unless `?mark_read=0` is passed or the request is from a read-only user. Reader and preview iframes use `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"` with `referrerPolicy="no-referrer"`; do not add `allow-scripts`. `server/readability.js` emits `<base target="_blank">` so newsletter links open outside the sandbox.

## Deployment Notes

Production runs on port 3002 under PM2 name `newsletter-app` and is deployed with the workspace `Deploy-Newsletter` PowerShell command. `ADMIN_EMAILS` is an optional comma-separated allowlist of Cloudflare Access emails with write access; empty or unset leaves all authenticated users writable, and non-admin users get `403 {"error":"read_only"}` for mutating requests while read-only UI hides Sync, Mark all read, Gmail reconnect, star, archive/restore, and mark-unread controls. nginx serves the newsletter subdomain root through its own vhost proxying to `localhost:3002`; the apex newsletter paths redirect to it. Do not change homepage `sw.js`, server routes, Gmail ingestion, or the SQLite schema for this migration.

## Home Screen notifications

Deployed 2026-11-01. All 18 tests and the production build passed on the VPS.
Authenticated worker/config/count checks and origin access gates passed; actual
iPad push delivery still needs a device opt-in and verification.

`server/push.js` uses `web-push` and the existing SQLite database. It creates
`push_settings` (persistent private VAPID credentials), `push_subscriptions`
(device subscriptions owned by authenticated writable users), and `push_badge`
(unread count/revision). Existing DB backups include these tables after rollout.
Never expose private keys or log subscription endpoints. Subscription writes retain
the Access/admin gate; read-only users do not get notification controls.

`public/sw.js` only handles push, app badge messages, and notification clicks; it
does not cache private pages or API data. Payloads carry the unread count so a closed
app need not fetch through Cloudflare Access. Each push displays a notification;
Safari also gets a declarative fallback. Read/archive changes and successful syncs
schedule a coalesced notification; duplicate/no-count-change actions are skipped.
Badge revisions prevent delayed pushes replacing newer counts.

`NotificationSettings` in the sidebar/mobile drawer manages this device's opt-in.
Permission is requested only on a tap. iPad users must install/open the standalone
Home Screen app. Sync cadence remains `SYNC_INTERVAL_MINUTES` (default 360); push
follows sync, not Gmail arrival in real time. See `DEPLOY.md` for rollout and iPad QA.

## Plan folders

New multi-phase plans go under `docs/plans/<slug>/` (see
`docs/plans/2026-07-newsletter-inbox`) with a `PROGRESS.md` per the convention in the
root `CLAUDE.md`. Register the plan folder in the root `projects.config.json` (path +
`totalPhases`) and run `node tools/project-status.mjs` from the repo root.
## Independent-app hosting ? 2026-11-01

The standalone build, identity, manifest and icon are deployed. ALLOW_NO_ACCESS_HEADER=0 is persisted in the private production .env and PM2 environment. Public requests now receive the Cloudflare Access login redirect (verified 2026-11-01); direct origin requests without identity remain 403. Preserve the existing allowlist and do not re-enable the development bypass. Notification deployment adds only its own SQLite tables; newsletter content and Gmail configuration are preserved.
