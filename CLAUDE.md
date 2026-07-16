# newsletter-app

Newsletter reader for the Gmail `Newsletters` label. The app is currently deployed at `https://newsletter.zo-bot.com`; the planned single-origin migration to `zo-bot.com/newsletter` has not happened yet.

## Stack

React 19 + Vite 6 + Tailwind CSS v4 frontend, with `react-router-dom` v7. Express 5 runs as the production server and as a Vite middleware plugin in dev. SQLite uses `better-sqlite3` at `data/newsletters.db`.

## Commands

```bash
npm run dev          # Start Vite dev server; use the Local URL Vite prints
npm run build        # Production build into dist/
npm start            # Start the production Express server
npm run oauth-setup  # One-time Gmail refresh token setup
```

Vite does not pin a dev port in `vite.config.js`; do not assume 5174. It is usually 5173 when free.

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

The Phase 2 UI is a Meco-style inbox shell:

- Dark left sidebar at `lg` and up with Today/Unread/Starred/Archived counts from `/api/counts`, sender sources from `/api/senders`, Sync, Mark all read, and a visible Zo-Bot home link.
- Redesigned list pane with search, date groups, snippets, unread dots, star/archive controls, read-time labels, selected highlight, and the existing 25/page server pagination.
- Light preview pane at `lg` and up. Selecting a newsletter fetches `GET /api/newsletters/:id`, which marks it read by design. Preview actions support star, archive/restore, mark unread, and expand to `/read/:id` with current list ids in router state.
- Below `lg` (under 1024px), the sidebar becomes a drawer, filter tabs appear above the list, there is no preview pane, and tapping a row navigates to `/read/:id`.

Do not add categories, AI features, Read Later, a TOC, progress bar, or text-size controls for this program.

## Backend Architecture

`server/plugin.js` creates the Express app for Vite dev middleware. `server.js` serves production static assets and registers the same API routes.

Key files:

- `server/gmail.js` - OAuth2 client, Gmail API calls, MIME body extraction.
- `server/sync.js` - fetches message IDs for the label, skips existing rows, inserts new newsletters.
- `server/routes.js` - API routes, server-side FTS search, counts, sender counts, read/star/archive state changes, and sync.
- `server/readability.js` - sanitizes newsletter HTML for iframe rendering.

Current API shape is defined by `server/routes.js`; trust it over stale notes elsewhere. `GET /api/newsletters/:id` marks the newsletter read unless `?mark_read=0` is passed. Reader and preview iframes use `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"` with `referrerPolicy="no-referrer"`; do not add `allow-scripts`. `server/readability.js` emits `<base target="_blank">` so newsletter links open outside the sandbox.

## Deployment Notes

Production runs on port 3002 under PM2 name `newsletter-app` and is deployed with the workspace `Deploy-Newsletter` PowerShell command. Phase 3 does not change nginx, the Vite `base`, service worker behavior, server routes, Gmail ingestion, or the SQLite schema.