# Phase 1 — Backend: `since` filter, counts endpoint, mark-read opt-out

**Goal:** every API the new inbox UI needs exists and is deployed, with **zero visible
change** to the current UI. Purely additive; `server/routes.js` is the only code file
that changes.

**Where this runs:** repo `newsletter-app` (Windows). No VPS/nginx work.

Read first: `00-overview.md` (fully — the guardrails and API table), then
`server/routes.js` top to bottom (~160 lines).

## Preconditions

- Clean working tree in `newsletter-app`; `npm run build` passes before you start
  (record it).
- `npm run dev` starts and `GET /api/newsletters` returns data (the dev Vite plugin
  mounts the API with no auth check).

## Steps

1. **`since` param on the list.** In `buildFilter(req)` (`server/routes.js:9`): parse
   `req.query.since` with `Number(...)`; if it's a finite number, push
   `n.internal_date >= ?` into `clauses` and the value into `params`. Because
   `buildFilter` is shared by the FTS and plain branches of `GET /api/newsletters`,
   `since` automatically composes with `q`, `filter`, and `sender`. Ignore invalid
   values silently (behave as if absent).

2. **`GET /api/counts`** — new endpoint (place it near `/api/senders`). Optional query
   param `since` (epoch-ms, same parsing rule). Response:

   ```json
   { "today": 4, "unread": 25, "starred": 7, "archived": 132, "total": 310 }
   ```

   - `today`: `internal_date >= ? AND archived_at IS NULL` — **0 when `since` is
     absent/invalid** (don't error).
   - `unread`: `read_at IS NULL AND archived_at IS NULL` (same definition the list
     endpoint already uses).
   - `starred`: `starred = 1 AND archived_at IS NULL`.
   - `archived`: `archived_at IS NOT NULL`.
   - `total`: `archived_at IS NULL`.

   One call feeds the whole sidebar. Per-sender counts stay on `/api/senders` — do not
   duplicate them here.

3. **`?mark_read=0` on `GET /api/newsletters/:id`.** Wrap the existing mark-read block
   (`server/routes.js:103-109`) so it is skipped when `req.query.mark_read === '0'`.
   When skipped, `newly_read` must be `false` and `read_at` must be returned as-is.
   Default behavior (no param, or any other value) is byte-for-byte unchanged. Purpose
   (locked decision 5): Phase 3's prev/next prefetch must not mark neighbors read.

## What NOT to do

- No schema changes, no `server/db.js` edits, no FTS changes.
- No changes to existing endpoints' response shapes (the current UI keeps running on
  them untouched until Phase 2 deploys).
- No `filter=today` server-side — the client will express Today as
  `filter=all&since=<local midnight>`.
- No frontend changes of any kind. No `server/gmail.js` / `server/sync.js` changes.

## Verification

Run against dev (`npm run dev`, port Vite prints) — curl each of these and record the
output. Pick a real unread id from the list response first.

```
# new endpoint, both modes
curl "http://localhost:<port>/api/counts"
curl "http://localhost:<port>/api/counts?since=<epoch-ms-of-local-midnight>"

# since on the list, alone and composed
curl "http://localhost:<port>/api/newsletters?since=<midnight>"
curl "http://localhost:<port>/api/newsletters?since=<midnight>&filter=unread"
curl "http://localhost:<port>/api/newsletters?since=<midnight>&q=the"

# mark_read=0 leaves the row unread…
curl "http://localhost:<port>/api/newsletters/<unread-id>?mark_read=0"   # newly_read false
curl "http://localhost:<port>/api/newsletters?filter=unread"             # id still present

# …and the default still marks read
curl "http://localhost:<port>/api/newsletters/<unread-id>"               # newly_read true
curl "http://localhost:<port>/api/newsletters?filter=unread"             # id gone
```

Regression-curl every pre-existing endpoint (list with each `filter`, `q`, `sender`;
`/api/senders`; `/api/summary`; star/read/archive toggles on a test row — then toggle
them back). Confirm `/api/summary`'s shape is unchanged (homepage + mcp-server depend
on it).

Also verify against the **prod entrypoint** once: `npm run build`, then
`ALLOW_NO_ACCESS_HEADER=1 node server.js` (port 3002) and repeat the `/api/counts`
curl — proves the standalone server path registers the route too (it uses the same
`registerRoutes`, but prove it).

Then: commit + push, `Deploy-Newsletter`, and confirm the deployed subdomain still
works in the browser (existing UI, which ignores the new params). From the workspace
root run `node tools/ops-check.mjs` (no ops changes expected — run it anyway).

## Rollback

Single revert + `Deploy-Newsletter`. The API is additive; nothing depends on it yet.

## Report

Append the Phase 1 report to `PROGRESS.md` (Status / What was built / Deviations /
Known gaps / Verification evidence — include the curl outputs) and update the status
blockquote at the top.
