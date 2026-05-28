# newsletter-app

Newsletter reader that pulls emails from a Gmail label and displays them in a two-pane UI.

## Stack

React 19 + Vite 6 + Tailwind CSS v4. Express backend runs as a Vite plugin (same pattern as finance-app). SQLite via better-sqlite3 at `data/newsletters.db`.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:5174
npm run build        # Production build
npm run oauth-setup  # One-time: get Gmail refresh_token (see Setup below)
```

## Gmail Setup (one time)

Reuses the same Google Cloud project as travel-app, but stores its own credentials independently.

1. `GOOGLE_GMAIL_CLIENT_ID` and `GOOGLE_GMAIL_CLIENT_SECRET` are already in `.env` (copied from travel-app).
2. Run `npm run oauth-setup` — follow the prompts to authorize and get a `GMAIL_REFRESH_TOKEN`.
3. Paste the refresh token into `.env`.
4. Set `NEWSLETTER_LABEL` to the exact name of your Gmail label (default: `Newsletters`).

## Architecture

The backend plugin (`server/plugin.js`) creates an Express app, initializes SQLite, and registers routes. Vite mounts it as middleware — no separate server process needed.

- `server/gmail.js` — OAuth2 client, Gmail API calls, MIME body extraction
- `server/sync.js` — fetches message IDs for the label, skips already-stored ones, inserts new ones
- `server/routes.js` — `GET /api/newsletters`, `GET /api/newsletters/:id`, `POST /api/sync`

The frontend is a two-pane layout: scrollable list on the left, sandboxed iframe reader on the right. Search filters client-side (no server round-trip).
