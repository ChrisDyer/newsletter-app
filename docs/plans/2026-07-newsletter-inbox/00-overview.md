# Newsletter Inbox Redesign + Single-Origin Migration — Overview

Rebuild newsletter-app's frontend as a Meco-style readable inbox (dark shell, sidebar
navigation, list pane, reading pane, full-screen immersive reader), then serve it at
`zo-bot.com/newsletter` so it opens **inside the installed Zo-Bot PWA** with no in-app
Safari bar. This executes the deferred decision 6 of the iPad-app program
(`../../../../homepage/docs/plans/2026-07-ipad-app/00-overview.md`): "adding them later
just repeats the Phase 1/2 pattern."

## Why

Newsletters are read daily on the iPad/iPhone PWA. Today they live on a separate
subdomain (cross-origin → Safari bar inside the installed app) and the UI is a single
list with a modal reader. Target: a proper reading experience — triage in a sidebar/list
layout, read full-screen — native to the single-origin PWA.

## Locked decisions (made by Chris, 2026-07-16 — do not relitigate)

1. **Same-origin path migration**, finance-variant (nginx prefix-STRIP): newsletter-app
   stays its own repo/process/port; nginx proxies `zo-bot.com/newsletter/` →
   `localhost:3002/` with the prefix stripped, so Express never sees `/newsletter` and
   `server.js`, PM2, the port, the backups cron, and the internal `/api/summary`
   consumers are all untouched. Old subdomain becomes a permanent 301.
2. **Out of scope, permanently for this program:** AI summaries/briefs, category/topic
   chips, Read Later state, reading-progress bar, "On this page" TOC, text-size
   control. Do not build these even if the reference screenshot shows them.
3. **Router:** `react-router-dom` v7 with `basename` derived from
   `import.meta.env.BASE_URL` (`BASE_URL.replace(/\/$/, '') || '/'`). Reader is a real
   route (`/read/:id`) so the back button works; inbox state (`filter`, `sender`, `q`)
   lives in **search params** on `/`, preserving the existing `?filter=` deep-link
   contract used by the homepage.
4. **Base-path plumbing from day one:** every frontend fetch goes through an
   `apiUrl()` helper built on `import.meta.env.BASE_URL` (pattern:
   `finance-app/src/utils.js`). Phase 4's only frontend change is then the Vite
   `base` flip.
5. **Mark-read behavior:** opening a newsletter (preview pane or reader) marks it read,
   as today — Gmail convention; "Mark unread" is the correction affordance. The
   `?mark_read=0` param added in Phase 1 exists solely so Phase 3's prev/next
   **prefetch** doesn't mark neighbors read.
6. **UI first on the existing subdomain, migration last.** Phases 1–3 deploy to
   `newsletter.zo-bot.com` via `Deploy-Newsletter` with zero VPS/nginx dependency;
   Phase 4 is a small final flip.
7. **Service worker: no changes.** Homepage's `sw.js` (scope `/`) already covers a new
   `/newsletter` path. API fetches under `/newsletter/api/` pass through uncached
   (fetch requests have empty `destination`, which is not in
   `CACHEABLE_DESTINATIONS`) — exactly how `/finance/api/` behaves today. Hashed
   `/newsletter/assets/*` getting stale-while-revalidate is fine. Verify, don't
   modify. If anyone nevertheless touches `sw.js`, the RUNBOOK CACHE-bump rule binds
   (`homepage/RUNBOOK.md`).
8. **"Today" is client-defined:** the client sends `since=<local-midnight-epoch-ms>`;
   the server just compares `internal_date >= since`. Timezone stays client-side (the
   VPS runs UTC; Chris is US Central).

## Target architecture

```
  Cloudflare (DNS, TLS, Zero Trust Access — apex app covers all paths)
                          │
              nginx on VPS 91.99.230.234
                          │
  zo-bot.com vhost ───────┼───────────────────────────────────────
    location /             → localhost:3004  homepage (PWA shell, sw.js scope '/')
    location /finance/     → localhost:3000  finance-app (prefix stripped)
    location /travel       → localhost:3001  travel-app (prefix kept, Next basePath)
    location /newsletter/  → localhost:3002  newsletter-app (prefix STRIPPED;   ← Phase 4
                                             Vite base '/newsletter/')
  newsletter.zo-bot.com vhost → 301 https://zo-bot.com/newsletter$request_uri  ← Phase 4

  newsletter-app frontend (Phases 2–3):
    /            inbox — sidebar (Today/Unread/Starred/Archived + Sources)
                 + list pane + preview pane (≥1024px); ?filter=&sender=&q=
    /read/:id    full-screen reader (light surface, toolbar, prev/next)
```

## Phase map and execution order

Run phases **strictly in order** — each depends on the previous being deployed.

| Phase | Doc | Repo / where it runs | Summary |
|---|---|---|---|
| 1 | `01-backend-today-counts.md` | `newsletter-app` | `since` filter, `/api/counts`, `?mark_read=0` — additive API only |
| 2 | `02-inbox-shell.md` | `newsletter-app` | Router + sidebar + list + preview pane, responsive (largest phase) |
| 3 | `03-reader-route.md` | `newsletter-app` | Full-screen `/read/:id` reader; delete the modal; link-target fix |
| 4 | `04-single-origin-migration.md` | `newsletter-app` + `homepage` + VPS nginx | Serve at `zo-bot.com/newsletter`, 301 subdomain, homepage links, docs |

## Hard guardrails (apply to every phase)

- **Never touch `data/newsletters.db`**, `server/db.js` schema, the FTS triggers, or
  anything under `data/`. This program needs zero schema changes.
- **Never touch `server/gmail.js` or `server/sync.js`** (Gmail ingestion is out of
  scope).
- **No capability regressions.** Sync button, mark-all-read, star, archive/restore,
  mark-unread, sender filtering, FTS search, pagination (25/page), and `?filter=`
  deep links must all survive every phase.
- **Rollback stays trivial.** Each phase is one revertable commit per repo (+
  `Deploy-Newsletter`). Phase 4 keeps the old vhost file as a redirect-only config,
  restorable to a proxy in one edit.
- **Ops-docs contract** (root `CLAUDE.md`): any change to nginx, URLs, or deploys
  updates root `README.md` tables and this app's `DEPLOY.md` **in the same session**,
  then `node tools/ops-check.mjs` (from the workspace root) must pass.
- Each phase ends by appending its report to `PROGRESS.md` (never rewrite earlier
  reports) and updating the status blockquote at the top.
- **No automated test suite exists in newsletter-app** — every phase's verification is
  a manual walkthrough + curl checklist. Do them all; record evidence in the report.

## Key facts

- VPS: Hetzner `91.99.230.234`, `ssh chris@91.99.230.234`. nginx vhosts at
  `/etc/nginx/sites-available/<app>`; reload with `sudo nginx -t && sudo systemctl
  reload nginx`. **sudo is interactive** — nginx edits are pasted by Chris, not run by
  agents (Phase 4 contains the exact commands).
- newsletter-app: React 19 + Vite 6 + Tailwind v4 SPA; Express 5 backend; SQLite
  (better-sqlite3, WAL) at `data/newsletters.db`. Prod: `node server.js` on port
  **3002**, PM2 name `newsletter-app`, deployed with PowerShell `Deploy-Newsletter`
  (git pull → npm install → vite build → pm2 restart). Dev: `npm run dev` — the
  Express backend mounts as a Vite plugin (`server/plugin.js`), one process. **Dev
  port:** `vite.config.js` sets no port; use whatever Vite prints (typically 5173 —
  the CLAUDE.md claim of 5174 is stale).
- Auth: Cloudflare Zero Trust Access at the edge (One-time PIN, "Chris and Kate"
  policy). Origin check in `server.js` (prod only): requests need the
  `cf-access-authenticated-user-email` header, or `x-internal-token` matching
  `INTERNAL_API_TOKEN`, or `ALLOW_NO_ACCESS_HEADER=1` (local testing). The Vite dev
  plugin has no auth check. The Cloudflare **apex** Access app already covers
  `zo-bot.com/newsletter` (path-inclusive) — no Cloudflare dashboard work in this
  program.
- Internal consumers of `GET /api/summary` — `homepage/server.js` and
  `mcp-server/server.js` — call `http://localhost:3002` directly with
  `x-internal-token`. The prefix-strip migration cannot affect them; Phase 4 verifies
  anyway.
- Unauthenticated curl against prod URLs gets a 302 to `cloudflareaccess.com` — that
  **is** the expected response; in-browser checks are the real test. VPS-local curls
  with a `Host:` header bypass Cloudflare entirely.
- **Trust `server/routes.js`, not `CLAUDE.md`.** The app's CLAUDE.md is stale (claims
  a two-pane layout and client-side search; reality is a single-pane list + modal
  reader and server-side FTS). Phase 2 rewrites it.

## Current backend API (verified 2026-07-16, `server/routes.js`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/newsletters` | `page` (0-based, 25/page), `q` (FTS), `filter` = all\|unread\|starred\|archived, `sender` (email). Returns `{newsletters, page, hasMore, total, unread, pageSize}`. Archived hidden except `filter=archived`. |
| GET | `/api/newsletters/:id` | Full row + `reader_html` (sanitized via `server/readability.js`). **Marks read as a side effect**; returns `newly_read`. |
| GET | `/api/senders` | Per-sender `{from_email, from_name, total, unread}`, archived excluded, ordered by total. |
| GET | `/api/summary` | `{total, recent, unread}` for the homepage dashboard — do not change its shape. |
| POST | `/api/newsletters/read-all` | Mark all unread read. |
| POST | `/api/newsletters/:id/star` | Toggle. |
| POST | `/api/newsletters/:id/read` | Body `{read}` (default true; false = mark unread). |
| POST | `/api/newsletters/:id/archive` | Body `{archived}` (default true; false = restore). |
| POST | `/api/sync` | Gmail sync; 409 if already running. |

`newsletters` columns available to the UI: `id, gmail_id, thread_id, from_name,
from_email, subject, date, internal_date (epoch-ms — the sort key), snippet,
read_at, archived_at, starred, reading_minutes`.

## Design reference (the screenshot, minus out-of-scope items)

- **Shell:** dark (the app is already `bg-gray-950`-based — this is a layout rebuild,
  not a theme flip). Left sidebar: app title; nav items **Today** (count), **Unread**
  (count), **Starred**, **Archived**; a **SOURCES** section listing senders with
  colored-initial avatars and unread counts, top ~8 with a "View all sources"
  expander; sync + mark-all-read affordances; a home link to the Zo-Bot launcher.
- **List pane:** search box ("/" focuses it), date-group headers (TODAY / YESTERDAY /
  full date), rows with avatar, sender name, subject (bold + dot when unread),
  snippet (1–2 lines), relative time, star toggle, read-time label ("6 min read").
  Selected row highlighted.
- **Preview pane (≥1024px only):** light reading card on the dark shell — sender
  header (avatar, name, date, read time), star/archive/mark-unread actions, an
  expand-to-full-screen affordance, the sanitized HTML in the sandboxed iframe.
- **Full-screen reader (`/read/:id`):** light reading surface, top toolbar (Back,
  Archive, Star, Mark unread, Original ↗), prev/next, keyboard (Esc/←/→), touch
  swipe.
- **Responsive:** three-pane ≥ 1024px; below that the sidebar collapses behind a
  drawer, filter tabs appear above the full-width list, and tapping a row navigates
  to `/read/:id`.

## Risk register

1. **Vite base vs SPA fallback** — prevented structurally by decisions 3–4 (all URLs
   BASE_URL-derived from Phase 2); Phase 4 explicitly reload-tests a deep link under
   `/newsletter/read/:id`.
2. **Router basename** — must be BASE_URL-derived with trailing-slash normalization
   from day one, or Phase 4 breaks routing silently in prod only.
3. **`GET /:id` mark-read side effect** — locked decision 5; agents must not "fix"
   idempotent double mark-read caused by React 19 StrictMode double-firing effects in
   dev.
4. **iframe link behavior** — the Phase 3 pair (`<base target="_blank">` in
   `toReaderHtml()` + `allow-popups-to-escape-sandbox` on the iframe) must land
   together, or popup tabs open JS-disabled.
5. **`lg:` breakpoint = 1024px = iPad Pro portrait width exactly** — test both sides
   of the boundary (iPad-app Phase 4 lesson).
6. **nginx needs Chris** (interactive sudo) — Phase 4 embeds paste-ready commands and
   a strict ordering (nginx → `Deploy-Newsletter` → `Deploy-Homepage`) that keeps the
   broken window to minutes.
7. **Hardcoded subdomain URLs elsewhere** — Phase 4 greps every repo for
   `newsletter.zo-bot.com`; the 301 stays permanently so stragglers still work.

## Status

See `PROGRESS.md` (source of truth). Registered in root `projects.config.json` as
`newsletter-inbox`, 4 phases.
