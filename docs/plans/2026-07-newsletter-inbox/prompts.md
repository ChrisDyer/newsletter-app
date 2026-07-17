# Launch Prompts — Newsletter Inbox Redesign + Single-Origin Migration

One prompt per phase. Run phases **strictly in order** (1 → 2 → 3 → 4) — each depends
on the previous being deployed. Paste the prompt for the current phase into a fresh
implementation agent session started in
`C:\Users\chris\OneDrive\Apps\zo-bot.com\newsletter-app`.

After each phase: review the diff, click through the deployed result yourself, and
confirm the `PROGRESS.md` report before launching the next agent. Phase 4 needs you
at the keyboard for the nginx paste and the on-device check.

---

## Phase 1 — Backend: `since` filter, counts, mark-read opt-out

```
You are implementing Phase 1 of the Newsletter Inbox program. Working directory:
C:\Users\chris\OneDrive\Apps\zo-bot.com\newsletter-app (its own git repo). Read, in
order, docs/plans/2026-07-newsletter-inbox/00-overview.md fully (the locked decisions
and guardrails are binding), then your work package
docs/plans/2026-07-newsletter-inbox/01-backend-today-counts.md. Trust
server/routes.js over CLAUDE.md — the latter is stale.
Mission: land the backend additions the new inbox UI needs, purely additively, with
zero visible change to the current UI. Scope: a `since` (epoch-ms) param folded into
buildFilter() so it composes with q/filter/sender; a new GET /api/counts endpoint
returning {today, unread, starred, archived, total} with `since` driving `today`; a
`?mark_read=0` opt-out on GET /api/newsletters/:id that skips the mark-read side
effect (default behavior byte-for-byte unchanged). server/routes.js is the only code
file that changes.
Do not touch server/db.js, the schema, FTS, gmail/sync code, the frontend, or any
existing endpoint's response shape. Never modify data/newsletters.db.
Done means: the full curl matrix in the work package passes in dev AND once against
ALLOW_NO_ACCESS_HEADER=1 node server.js with a fresh build; every pre-existing
endpoint regression-curled; committed, pushed, Deploy-Newsletter run and the
subdomain spot-checked; node ../tools/ops-check.mjs passes; Phase 1 report appended
to docs/plans/2026-07-newsletter-inbox/PROGRESS.md with the status blockquote
updated.
```

## Phase 2 — Inbox shell: router, sidebar, list, preview pane

```
You are implementing Phase 2 of the Newsletter Inbox program. Phase 1 is deployed
(/api/counts and since= exist). Working directory:
C:\Users\chris\OneDrive\Apps\zo-bot.com\newsletter-app (its own git repo). Read, in
order, docs/plans/2026-07-newsletter-inbox/00-overview.md fully — locked decisions
2-5 and the design reference are binding — then your work package
docs/plans/2026-07-newsletter-inbox/02-inbox-shell.md, then the current src/ code
you are replacing, then ../finance-app/src/utils.js for the apiUrl pattern.
Mission: rebuild the frontend as the Meco-style inbox shell on the existing
subdomain — dark left sidebar (Today/Unread/Starred/Archived with counts from
/api/counts, SOURCES from /api/senders with avatars and unread badges, sync +
mark-all-read, home link), redesigned list pane (date groups, snippets, star, read
time, selected highlight, existing 25/page pagination), light preview pane at
lg:+ with star/archive/mark-unread and an expand affordance, and a minimal /read/:id
reader stub. react-router-dom v7 with basename derived from import.meta.env.BASE_URL
exactly as specified; filter/sender/q live in URL search params; the homepage's
?filter=unread deep link must keep working; every fetch goes through a new apiUrl()
helper — zero bare absolute fetches may remain in src/.
Do not touch server/ code, the Vite base, or the iframe sandbox attributes; build
none of: categories, AI features, Read Later, TOC, progress bar, text-size control.
Done means: npm run build passes; the four-width walkthrough (~1400 / exactly 1024 /
~678 / ~390) and the full functional matrix in the work package pass in dev; the
prod-entrypoint nested-route reload check passes; CLAUDE.md rewritten to match
reality; committed, pushed, Deploy-Newsletter run and prod spot-checked;
node ../tools/ops-check.mjs passes; Phase 2 report appended to
docs/plans/2026-07-newsletter-inbox/PROGRESS.md with the status blockquote updated.
```

## Phase 3 — Full-screen reader route

```
You are implementing Phase 3 of the Newsletter Inbox program. Phases 1-2 are
deployed. Working directory:
C:\Users\chris\OneDrive\Apps\zo-bot.com\newsletter-app (its own git repo). Read, in
order, docs/plans/2026-07-newsletter-inbox/00-overview.md (locked decisions 2 and 5,
risk 4), then your work package
docs/plans/2026-07-newsletter-inbox/03-reader-route.md, then the old
src/components/NewsletterReader.jsx (port its keyboard/swipe handlers before
deleting it) and server/readability.js.
Mission: make /read/:id the immersive full-screen reader and delete the modal.
Scope: ReaderPage with a light reading surface and toolbar (Back with cold-deep-link
fallback, Archive, Star, Mark unread, Original -> Gmail permalink by gmail_id);
prev/next carried via router navigation state with replace:true, neighbors
prefetched with ?mark_read=0 and only marked read when actually displayed; Esc/
arrow-key and 60px touch-swipe navigation; and the paired link fix that must land in
one commit — <base target="_blank"> added in toReaderHtml() AND
allow-popups-to-escape-sandbox added to the reader/preview iframe sandbox (keep
referrerPolicy no-referrer, never add allow-scripts); NewsletterReader.jsx deleted
with no dangling references.
Do not touch server/routes.js or the Vite base; no TOC/progress/text-size/AI.
Done means: npm run build passes; the work package's walkthrough passes including
the two critical proofs — prefetched neighbors stay unread until viewed, and a link
inside a newsletter opens a fully functional (JS-enabled) new tab; the
prod-entrypoint deep-link reload of /read/<id> passes; committed, pushed,
Deploy-Newsletter run and prod spot-checked; node ../tools/ops-check.mjs passes;
Phase 3 report appended to docs/plans/2026-07-newsletter-inbox/PROGRESS.md with the
status blockquote updated.
```

## Phase 4 — Single origin: `zo-bot.com/newsletter`

```
You are implementing Phase 4 (final) of the Newsletter Inbox program. Phases 1-3 are
deployed. This phase touches TWO repos with separate commits and deploys —
C:\Users\chris\OneDrive\Apps\zo-bot.com\newsletter-app (working directory) and
C:\Users\chris\OneDrive\Apps\zo-bot.com\homepage — plus nginx on the VPS, where
Chris pastes the commands (sudo is interactive; never attempt sudo yourself). Read,
in order, docs/plans/2026-07-newsletter-inbox/00-overview.md (locked decisions 1, 6,
7 and risks 1, 6, 7), your work package
docs/plans/2026-07-newsletter-inbox/04-single-origin-migration.md, the proven
template ../homepage/docs/plans/2026-07-ipad-app/01-finance-under-path.md, and
../homepage/CLAUDE.md.
Mission: serve the inbox at https://zo-bot.com/newsletter/ with
newsletter.zo-bot.com 301-redirecting (query strings preserved) so the installed
Zo-Bot PWA opens it with no in-app Safari bar. Follow the work package's step order
EXACTLY: (1) newsletter-app commit — production-only Vite base '/newsletter/',
grep gate for stray absolute URLs, standalone-gated "Zo-Bot Home" link copied from
finance-app's Sidebar — pushed but NOT deployed; (2) hand Chris the nginx block
(backups, apex prefix-STRIPPING location, redirect-only old vhost kept on disk,
nginx -t + reload) and wait for his confirmation; (3) immediately Deploy-Newsletter;
(4) homepage launcher edits (nav href, URLS map, stale comment) + Deploy-Homepage;
(5) cross-repo grep sweep for newsletter.zo-bot.com; (6) same-session doc updates
(root README.md apps table, DEPLOY.md, CLAUDE.md) until node ../tools/ops-check.mjs
passes.
Never touch homepage/sw.js. Do not delete the old vhost file. No server-code or UI
changes beyond the home-affordance gating.
Done means: the work package's verification passes — full walkthrough at
zo-bot.com/newsletter/ with a deep-link reload of /newsletter/read/<id>, 301 checks
with query preservation, VPS-local x-internal-token curl of /api/summary, Cache
Storage shows no /newsletter/api/ entries, and Chris's on-device checklist (no
Safari bar; Zo-Bot Home visible only in standalone) — plus ops-check passing; Phase
4 report appended to docs/plans/2026-07-newsletter-inbox/PROGRESS.md, the status
blockquote set to complete, and node ../tools/project-status.mjs run from the
workspace root.
```
