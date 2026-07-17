# Newsletter Inbox Redesign + Single-Origin Migration — Progress

> **Status: All 4 phases complete — program closed out.** Single-origin migration
> (Phase 4) live at `https://zo-bot.com/newsletter/`; old `newsletter.zo-bot.com`
> 301-redirects there.
> Append one report per completed phase. Never rewrite an earlier phase report;
> later corrections are new dated entries.

Program docs: `00-overview.md` (read first), phase specs `01`–`04`, launch prompts in
`prompts.md`. Registered in root `projects.config.json` as `newsletter-inbox`
(4 phases).

Report format for each phase (per root `CLAUDE.md`):

```markdown
## Phase <N> — <name> — YYYY-MM-DD

**Status:** blocked | complete-with-deviations | blocked
**What was built/done:** …
**Deviations from spec (and why):** …
**Known gaps / follow-ups:** …
**Verification evidence:** …
```

## Phase 1 - Backend since/counts/mark-read opt-out - 2026-07-16

**Status:** blocked
**What was built/done:** Added finite-number `since` parsing to the shared newsletter list filter, so it composes with `filter`, `sender`, and FTS `q`. Added `GET /api/counts` returning `{today, unread, starred, archived, total}` with `today` driven by valid `since` and zero when absent. Added `?mark_read=0` to `GET /api/newsletters/:id`, preserving the default mark-read behavior for all other requests.
**Deviations from spec (and why):** Verification ran against an isolated copy under `C:\tmp\newsletter-phase1-test` so the required mark-read/star/archive curls did not modify the real `data/newsletters.db`. `/api/sync` was regression-curled there and reached the existing handler, but returned 500 because the copied Google OAuth refresh token produced `invalid_grant`; this was an environment credential failure, not a route regression.
**Known gaps / follow-ups:** Push, `Deploy-Newsletter`, deployed subdomain spot-check, and `node tools/ops-check.mjs` are still pending because approval to push to `https://github.com/ChrisDyer/newsletter-app.git` was rejected by the approval reviewer. Phase 2 should wait until those finish.
**Verification evidence:**
- Baseline before edits: `npm run build` passed.
- Post-edit repo build: `npm run build` passed.
- Dev server (`http://127.0.0.1:5173`, isolated DB): `GET /api/counts` -> `{"today":0,"unread":538,"starred":0,"archived":0,"total":538}`.
- Dev server: `GET /api/counts?since=1784178000000` -> `{"today":0,"unread":538,"starred":0,"archived":0,"total":538}`.
- Dev server: `GET /api/newsletters?since=1784178000000` -> `total=0 returned=0 pageSize=25`; `&filter=unread` -> `total=0 returned=0`; `&q=the` -> `total=0 returned=0`.
- Dev server mark-read opt-out using unread id `439`: `GET /api/newsletters/439?mark_read=0` -> `newly_read=false read_at=null`; follow-up unread list still contained id `439` on the first page.
- Dev server default mark-read using id `439`: `GET /api/newsletters/439` -> `newly_read=true`; follow-up unread list no longer contained id `439` on the first page.
- Existing endpoint regression curls: list filters `all/unread/starred/archived` returned `538/538/0/0` totals; `q=the` returned `538`; sender filter for `publications@understandingwar.org` returned `101`; `/api/senders` returned `7` senders; `/api/summary` shape stayed `{total,recent,unread}` with values `{538,0,538}`; detail endpoint returned `reader_html`; star/read/archive toggles returned `1->0`, `true->false`, and `true->false` respectively.
- Standalone production entrypoint in isolated copy after fresh build: `ALLOW_NO_ACCESS_HEADER=1 SYNC_INTERVAL_MINUTES=0 PORT=3002 node server.js`; `GET /api/counts` -> `{"today":0,"unread":538,"starred":0,"archived":0,"total":538}`.
## Phase 2 - Inbox shell - 2026-07-16

**Status:** complete-with-deviations
**What was built/done:** Rebuilt the frontend as a router-based inbox shell with `react-router-dom` v7 and the required BASE_URL-derived basename. Added `src/api.js` and routed every frontend fetch through `apiUrl()`. Added the dark sidebar with Today/Unread/Starred/Archived counts, sender sources with avatars/unread badges, Sync, Mark all read, and Zo-Bot home link. Rebuilt the list pane with search-param-backed `filter`, `sender`, and `q`, date groups, snippets, unread dots, read-time labels, selected highlight, row star/archive controls, and existing 25/page pagination. Added the light `lg:` preview pane with star/archive/mark-unread/expand actions and unchanged iframe sandbox attributes. Added the minimal `/read/:id` reader stub with Back preserving search params. Rewrote `CLAUDE.md` to match the current architecture.
**Deviations from spec (and why):** The in-app browser connector reported `No browser is available`, so the required browser walkthrough was performed with the already-installed local Chromium binary via CDP instead of the Codex in-app browser. The local DB has only 7 senders, so the `View all sources` expander is hidden in normal QA data; the implementation will show it when sender count exceeds 8. The Mark all read destructive action was not executed against the real local DB; the guarded control was verified present, while reversible single-newsletter state actions were exercised and restored. Local Sync returned the existing environment `invalid_grant` OAuth error and the UI displayed it gracefully.
**Known gaps / follow-ups:** Production deploy was completed by Chris after pushing the Phase 2 commit to the VPS-tracked `master` branch. Phase 3 still owns the complete full-screen reader, prev/next reader behavior, original-link behavior, and the paired iframe sandbox/server HTML changes. Phase 4 still owns the Vite base flip and single-origin migration.
**Verification evidence:**
- `npm run build` passed after implementation.
- Bare fetch audit: `rg -n "fetch\(" src` showed all fetches wrapped in `apiUrl(...)`; no `fetch('/...')` or `fetch("/...")` remained.
- Dev API precheck at `http://127.0.0.1:5173`: `/api/counts` -> `{"today":0,"unread":538,"starred":0,"archived":0,"total":538}`; `/api/senders` returned 7 senders; `?filter=unread` list returned 25 rows with `hasMore=true` and `pageSize=25`.
- Four-width Chromium walkthrough screenshots written to `C:\tmp\newsletter-phase2-shots`: 1400 and exactly 1024 showed sidebar + preview; 678 and 390 showed hamburger/mobile tabs and no preview; all widths rendered 25 rows.
- Functional checks: `?filter=unread` deep link loaded 25 rows; source click set `sender=dan@tldrnewsletter.com` and kept 25 filtered rows; selecting a row on wide loaded the preview iframe and selected highlight; preview star toggled `Star -> Unstar -> Star`; preview mark-unread restored unread state; row star toggled on/off; row archive removed the row and was restored via API; search `/` focused the search input, typing set `q=space`, and Esc cleared/blured it; pagination with `filter=unread` changed the first row; mobile row tap navigated to `/read/439` with an iframe and Back returned to `/?filter=unread`.
- Today filter API translation checked with local midnight `since=` and returned zero rows, matching `/api/counts.today=0` for this DB/date.
- Production entrypoint check after `npm run build`: `ALLOW_NO_ACCESS_HEADER=1 SYNC_INTERVAL_MINUTES=0 PORT=3002 node server.js`; `/` returned 200, `/api/counts` returned counts, and hard reload of `/read/439` returned 200 with the SPA root.
- Post-deploy: Chris pushed the commit to `master`, ran `Deploy-Newsletter`, and confirmed the production site shows the new Phase 2 shell.
## Phase 3 - Full-screen reader route - 2026-07-16

**Status:** complete-with-deviations
**What was built/done:** Replaced the `/read/:id` stub with the full-screen light reader route, including Back with cold-link fallback, archive/restore, star, mark-unread-then-return, Gmail Original link, sender/date/read-time header, Esc and ArrowLeft/ArrowRight keyboard navigation, and 60px touch-swipe navigation. Current page ids are carried from narrow list taps and wide preview expand via router state, and prev/next navigation uses `replace: true`. Adjacent newsletters are prefetched with `?mark_read=0`; cached neighbors are marked read only when displayed. Deleted `NewsletterReader.jsx` and `ReaderStub.jsx`. Added the paired link fix: `toReaderHtml()` emits `<base target="_blank">`, and both reader/preview iframes use `sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"` with `referrerPolicy="no-referrer"` and no `allow-scripts`. Updated `CLAUDE.md` for the completed reader route.
**Deviations from spec (and why):** The Codex in-app browser connector reported `No browser is available`, so browser walkthroughs used installed headless Chrome via localhost CDP instead. The Gmail Original action was verified as the expected `https://mail.google.com/mail/u/0/#all/<gmail_id>` URL generation path; live Gmail authentication behavior was not exercised from the headless test profile.
**Known gaps / follow-ups:** Phase 4 still owns the single-origin `/newsletter` migration and Vite `base` flip. `npm install` during deployment reported the existing audit state of 5 vulnerabilities (4 moderate, 1 high); no dependency changes were made in Phase 3.
**Verification evidence:**
- `npm run build` passed after implementation.
- Static sweep: no `NewsletterReader` or `ReaderStub` references remained; no `allow-scripts` was present; `toReaderHtml()` emitted `<base target="_blank">`; ReaderPage and PreviewPane both had `allow-popups-to-escape-sandbox` with `referrerPolicy="no-referrer"`.
- Prefetch/unread proof on local dev server: before unread first five `439,440,441,238,239`; opening `439` returned `newly_read=true`; prefetching `440?mark_read=0` returned `newly_read=false` and `read_at=null`; unread first five after prefetch `440,441,238,239,240`; marking displayed `440` read removed it from unread; rows `439` and `440` were restored to unread afterward.
- Headless Chrome mobile walkthrough at 390px: tapping the first unread row navigated to `/read/439?filter=unread`; ArrowRight navigated with replace/state to `/read/440?filter=unread`; Esc returned to `/?filter=unread`.
- Headless Chrome wide walkthrough at 1400px: selecting a row loaded the preview iframe; Expand navigated to `/read/441?filter=unread`; Back returned to `/?filter=unread`; QA rows `439`, `440`, and `441` were restored unread afterward.
- Link sandbox proof in headless Chrome: a sandboxed iframe using the app's exact `sandbox` flags plus `<base target="_blank">` opened a new tab to a localhost target page; the target page's inline JS ran (`title=JSOK`, `jsRan=true`), proving popups escape the script-disabled sandbox.
- Production-entrypoint deep-link check after `npm run build`: `ALLOW_NO_ACCESS_HEADER=1 SYNC_INTERVAL_MINUTES=0 PORT=3002 node server.js`; direct load/reload of `http://127.0.0.1:3002/read/439` returned 200 and the SPA root.
- `Deploy-Newsletter` completed for the Phase 3 commit: the VPS checkout was updated to `origin/master`, `npm install` completed, `npm run build` passed, and PM2 restarted `newsletter-app` online.
- VPS-local production spot-check: `http://127.0.0.1:3002/read/439` returned `read_status=200` with SPA root; `GET /api/newsletters/439?mark_read=0` detail response contained `_blank` reader HTML and a detail payload.
- Public production spot-check at `https://newsletter.zo-bot.com/?filter=unread` in headless Chrome: page title `Newsletters`, 9 rows rendered, tapping a row opened `/read/582?filter=unread` with a reader iframe, and Esc returned to `/?filter=unread`; row `582` was restored unread afterward.
- `node tools\\ops-check.mjs` from the workspace root passed: `ops-check: OK - 8 apps, README/$PROFILE/docs all consistent`.

## Phase 4 - Single origin: zo-bot.com/newsletter - 2026-07-16

**Status:** complete-with-deviations
**What was built/done:** `vite.config.js` flipped to `base: '/newsletter/'` in production (dev stays `/`). nginx on the apex `zo-bot.com` vhost now proxies `location /newsletter/` to `localhost:3002` with the prefix stripped; the old `newsletter` vhost was reduced to a redirect-only `return 301 https://zo-bot.com/newsletter$request_uri;`. `homepage/index.html` (`nav-newsletter` href and the `URLS.newsletter` map feeding the `N` shortcut) now points at `/newsletter` instead of the subdomain (homepage commit `0ebc70e`, deployed separately via `Deploy-Homepage`). `homepage/sw.js` was not touched, per the plan's locked decision. Root `README.md` and both apps' `CLAUDE.md` were updated to describe the new URL as current reality. Also added, beyond the original Phase 4 scope: a Gmail OAuth reconnect flow (`server/gmailAuth.js`, `/api/gmail/oauth/*`, a "Reconnect Gmail" button in `SyncButton`) so an expired refresh token can be fixed from the UI instead of a manual `oauth-setup` CLI run.
**Deviations from spec (and why):** The implementing session's own verification evidence (browser walkthrough, deep-link reload check, Cache Storage inspection, on-device PWA check) was not captured in this file at the time — the migration was built and deployed live, and both apps' code/config plus the ops docs were committed together only in this session, after the fact. The Gmail OAuth reconnect flow is unscoped addition, not part of the original Phase 4 plan. Chris confirmed the migration is live and working and asked to close out the program rather than back-fill the missing verification detail.
**Known gaps / follow-ups:** No first-hand record of the on-device PWA check (plan step 8) or the Cache Storage inspection (step 7) — the plan calls for both but neither is documented here. If a regression is ever suspected in either area, re-run those two checks manually.
**Verification evidence:**
- Current file state confirms the plan's steps: `newsletter-app/CLAUDE.md` documents `base: '/newsletter/'` and the redirect; root `README.md`'s apps table reads `zo-bot.com/newsletter (old newsletter.zo-bot.com 301s here)`; `homepage/index.html:284,312` point at `/newsletter`; `homepage/sw.js` has no commits since Phase 3 (PWA shell), confirming it was left alone.
- Workspace-wide grep for `newsletter.zo-bot.com` returns only historical plan/progress docs (this file, `00-overview.md`, `02-inbox-shell.md`, `04-single-origin-migration.md`, `prompts.md`, and the "old ... 301s here" line in `CLAUDE.md`/`README.md`) — no live code references remain.
- `node tools/ops-check.mjs` passed after this session's commits.
- Chris confirmed the migration is live and working in production and asked to mark the program complete.

## Phase 1 (correction) - push-approval block resolved - 2026-07-16

**Status:** complete
**What was built/done:** No code changes — this corrects the record. Phase 1's own report above says push/deploy were blocked because "approval to push... was rejected by the approval reviewer." That block did not persist: Phase 2's report (same day) shows Chris pushed to `master` and ran `Deploy-Newsletter` successfully, which necessarily included the Phase 1 backend work (`since`/`/api/counts`/`mark_read=0`) already sitting on top of it in the same commit history. Per the PROGRESS.md convention, the original Phase 1 entry is left as-is (it accurately records what was true at that moment); this entry records the correction instead of rewriting it.
**Deviations from spec (and why):** None beyond the record-keeping gap itself — nothing was ever re-verified against production specifically for Phase 1's endpoints in isolation, since Phase 2 and later sessions built on top of them without incident.
**Known gaps / follow-ups:** None.
**Verification evidence:** Phase 2's report entry above: "Post-deploy: Chris pushed the commit to `master`, ran `Deploy-Newsletter`, and confirmed production site shows new Phase 2 shell" — this is only possible if the Phase 1 push/deploy block was already cleared by that point.