# Phase 4 — Single origin: `zo-bot.com/newsletter`

**Goal:** the inbox is fully usable at `https://zo-bot.com/newsletter/` (SPA, assets,
APIs, deep links); `https://newsletter.zo-bot.com/*` permanently 301s there with query
strings preserved; the installed Zo-Bot PWA opens Newsletters with **no in-app Safari
bar**; all ops docs describe the new reality.

**Where this runs:** repos `newsletter-app` **and** `homepage` (separate commits and
deploys) + nginx on the VPS. **nginx steps are pasted by Chris over ssh** (sudo is
interactive) — present them as a block and wait for confirmation before proceeding.

Read first: `00-overview.md` (locked decisions 1, 4, 6, 7; risks 1, 6, 7), the proven
template `../../../../homepage/docs/plans/2026-07-ipad-app/01-finance-under-path.md`,
and `homepage/CLAUDE.md`.

**Step order below is mandatory** — it keeps the broken window (deployed base path
without nginx, or vice versa) to minutes.

## Preconditions

- Phases 1–3 deployed and working on the subdomain. Clean working trees in both
  repos; `npm run build` passes in newsletter-app.
- Chris is available to paste the nginx commands.

## Steps

1. **newsletter-app: base path + home affordance (commit, do NOT deploy yet).**
   - `vite.config.js` → function form:
     `defineConfig(({ mode }) => ({ base: mode === 'production' ? '/newsletter/' : '/', ... }))`.
     Dev stays base `/` — `npm run dev` must be byte-for-byte unchanged.
   - **Grep gate** (risk 1): search `src/` and `index.html` for any absolute URL that
     escaped Phase 2 — `fetch('/`, `href="/`, `src="/`, `EventSource('/`,
     `new URL('/`. Everything app-relative must go through `apiUrl()` /
     router-relative paths. (External `https://` links are fine.)
   - Sidebar home link becomes the standalone-gated affordance: `href="/"` (the
     launcher — same origin after this phase) with visibility
     `hidden [@media(display-mode:standalone)]:flex`, label "Zo-Bot Home" — copy the
     pattern at `finance-app/src/components/Sidebar.jsx:118-126`. In normal browsing
     it's hidden; inside the installed PWA it appears.
   - `npm run build`; inspect `dist/index.html` — asset URLs must start with
     `/newsletter/assets/`.
   - Commit + push. **Do not run `Deploy-Newsletter` until step 2 is done** (the
     built asset paths 404 on the subdomain-as-served-today).

2. **nginx (CHRIS pastes, over `ssh chris@91.99.230.234`).**

   ```bash
   # backups
   sudo cp /etc/nginx/sites-available/homepage   /etc/nginx/sites-available/homepage.pre-newsletter-phase4.bak
   sudo cp /etc/nginx/sites-available/newsletter /etc/nginx/sites-available/newsletter.pre-newsletter-phase4.bak
   ```

   Edit `/etc/nginx/sites-available/homepage` (the apex `zo-bot.com` vhost — confirm
   with `grep -l 'server_name zo-bot.com' /etc/nginx/sites-available/*`), adding
   alongside the existing `/finance/` block:

   ```nginx
   location = /newsletter { return 301 /newsletter/; }
   location /newsletter/ {
       proxy_pass http://localhost:3002/;   # trailing slash STRIPS /newsletter
       # copy the proxy_set_header block used by the existing location /finance/
   }
   ```

   Edit `/etc/nginx/sites-available/newsletter`: replace the `location /` proxy block
   with redirect-only (keep the file, the `server_name`, and the TLS lines — rollback
   is restoring the proxy):

   ```nginx
   return 301 https://zo-bot.com/newsletter$request_uri;
   ```

   Then: `sudo nginx -t && sudo systemctl reload nginx`.

3. **Deploy newsletter-app immediately:** `Deploy-Newsletter`. The subdomain was
   serving old-base assets during step 2's window; this closes it. Quick browser
   check: `https://zo-bot.com/newsletter/` loads.

4. **homepage: repoint the launcher.** In `homepage/index.html`:
   - Line ~284: `<a class="nav-item" id="nav-newsletter" href="https://newsletter.zo-bot.com">`
     → `href="/newsletter"`.
   - Line ~312: `URLS` map `newsletter: 'https://newsletter.zo-bot.com'` →
     `'/newsletter'` (feeds the `N` keyboard shortcut at line ~450).
   - Line ~307: update the comment claiming newsletter/home stay on subdomains
     (home-app still does; newsletter no longer).
   - **Do not touch `sw.js`** (locked decision 7). `homepage/server.js`'s
     `BASES.newsletter` stays `http://localhost:3002` — prefix-strip means Express
     paths are unchanged; verify, don't assume.
   - Commit + push, `Deploy-Homepage`.

5. **Cross-app URL sweep.** From the workspace root, grep every repo for
   `newsletter.zo-bot.com`. Expected hits: the homepage edits above (done) and docs.
   Update docs that describe current reality; leave historical plan/progress docs
   as-is (they record what was true then). If a code hit appears anywhere else, fix
   it in that repo with its own commit + deploy.

6. **Ops docs (same session — the contract).**
   - Root `README.md` apps table: newsletter URL → `zo-bot.com/newsletter (old
     newsletter.zo-bot.com 301s here)` — match the finance/travel row wording. Port,
     PM2 name, repo, `Deploy-Newsletter`, and the backups-table row are all
     unchanged — state that in the report.
   - `newsletter-app/DEPLOY.md`: new URL, vhost now redirect-only + apex location
     block, dated note that the subdomain was retired as the serving URL.
   - `newsletter-app/CLAUDE.md`: URL reference.
   - `node tools/ops-check.mjs` from the workspace root must pass.

7. **Service worker: verify, don't modify.** In prod DevTools (Application → Cache
   Storage, `zobot-v1`): after browsing `/newsletter/`, confirm **no**
   `/newsletter/api/...` responses and no navigation responses are cached (hashed
   `/newsletter/assets/*` entries are fine and expected).

8. **[CHRIS] On-device check** (installed PWA on iPad/iPhone): open Zo-Bot →
   Newsletters — no in-app Safari bar; read one newsletter full-screen; prev/next;
   "Zo-Bot Home" affordance visible in the sidebar (standalone only) and returns to
   the launcher; `N` keyboard shortcut on desktop goes to `/newsletter`.

## What NOT to do

- **Never touch `homepage/sw.js`.** If you believe you must, stop and re-read locked
  decision 7; any change triggers the RUNBOOK CACHE-bump rule.
- Do not remove the old `newsletter` vhost file. Do not change ports, PM2 config, the
  backups cron, or `.env` on the VPS.
- No UI changes beyond the home-affordance gating. No server-code changes in either
  repo.

## Verification

- Browser, authenticated: `https://zo-bot.com/newsletter/` — full walkthrough
  (sidebar filters, a source, search, preview read, full-screen read, star/archive).
  Network tab: all requests are `/newsletter/api/...` or `/newsletter/assets/...`,
  no 404s.
- **Deep-link reload** (risk 1): load `https://zo-bot.com/newsletter/read/<id>`,
  hit reload — the app must come back (SPA fallback through the prefix-strip).
- Redirects: `https://newsletter.zo-bot.com/` → 301 → `https://zo-bot.com/newsletter/`;
  `https://newsletter.zo-bot.com/?filter=unread` preserves the query. (Unauthenticated
  curl shows the Cloudflare Access 302 — that's expected; check redirects in the
  browser or with VPS-local curls using a `Host:` header.)
- VPS-local: `ssh chris@91.99.230.234`, then
  `curl -s -H 'x-internal-token: <token>' http://localhost:3002/api/summary` — the
  homepage dashboard's consumer path still works.
- Homepage: `https://zo-bot.com` launcher → Newsletters lands on `/newsletter`
  without leaving the origin; `N` shortcut ditto.
- Step 7 (Cache Storage) and step 8 (on-device) pass.
- `node tools/ops-check.mjs` passes.

## Rollback

Restore both `.pre-newsletter-phase4.bak` vhosts (Chris), `sudo nginx -t && sudo
systemctl reload nginx`; revert the newsletter-app commit and `Deploy-Newsletter`;
revert the homepage commit and `Deploy-Homepage`. No data risk — the DB is untouched
throughout.

## Report

Append the Phase 4 report to `PROGRESS.md` (include the nginx diff, the grep-sweep
results, and the on-device checklist results), update the status blockquote to
**complete**, and — since this closes the program — run
`node tools/project-status.mjs` from the workspace root.
