# Newsletter Inbox Redesign + Single-Origin Migration â€” Progress

> **Status: Phase 2 inbox shell built, locally verified, and ready for deploy**
> Append one report per completed phase. Never rewrite an earlier phase report;
> later corrections are new dated entries.

Program docs: `00-overview.md` (read first), phase specs `01`â€“`04`, launch prompts in
`prompts.md`. Registered in root `projects.config.json` as `newsletter-inbox`
(4 phases).

Report format for each phase (per root `CLAUDE.md`):

```markdown
## Phase <N> â€” <name> â€” YYYY-MM-DD

**Status:** blocked | complete-with-deviations | blocked
**What was built/done:** â€¦
**Deviations from spec (and why):** â€¦
**Known gaps / follow-ups:** â€¦
**Verification evidence:** â€¦
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
**Known gaps / follow-ups:** Phase 3 still owns the complete full-screen reader, prev/next reader behavior, original-link behavior, and the paired iframe sandbox/server HTML changes. Phase 4 still owns the Vite base flip and single-origin migration.
**Verification evidence:**
- `npm run build` passed after implementation.
- Bare fetch audit: `rg -n "fetch\(" src` showed all fetches wrapped in `apiUrl(...)`; no `fetch('/...')` or `fetch("/...")` remained.
- Dev API precheck at `http://127.0.0.1:5173`: `/api/counts` -> `{"today":0,"unread":538,"starred":0,"archived":0,"total":538}`; `/api/senders` returned 7 senders; `?filter=unread` list returned 25 rows with `hasMore=true` and `pageSize=25`.
- Four-width Chromium walkthrough screenshots written to `C:\tmp\newsletter-phase2-shots`: 1400 and exactly 1024 showed sidebar + preview; 678 and 390 showed hamburger/mobile tabs and no preview; all widths rendered 25 rows.
- Functional checks: `?filter=unread` deep link loaded 25 rows; source click set `sender=dan@tldrnewsletter.com` and kept 25 filtered rows; selecting a row on wide loaded the preview iframe and selected highlight; preview star toggled `Star -> Unstar -> Star`; preview mark-unread restored unread state; row star toggled on/off; row archive removed the row and was restored via API; search `/` focused the search input, typing set `q=space`, and Esc cleared/blured it; pagination with `filter=unread` changed the first row; mobile row tap navigated to `/read/439` with an iframe and Back returned to `/?filter=unread`.
- Today filter API translation checked with local midnight `since=` and returned zero rows, matching `/api/counts.today=0` for this DB/date.
- Production entrypoint check after `npm run build`: `ALLOW_NO_ACCESS_HEADER=1 SYNC_INTERVAL_MINUTES=0 PORT=3002 node server.js`; `/` returned 200, `/api/counts` returned counts, and hard reload of `/read/439` returned 200 with the SPA root.