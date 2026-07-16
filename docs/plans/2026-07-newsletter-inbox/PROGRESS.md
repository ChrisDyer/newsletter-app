# Newsletter Inbox Redesign + Single-Origin Migration — Progress

> **Status: Phase 1 backend built and locally verified; push/deploy blocked pending explicit approval**
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