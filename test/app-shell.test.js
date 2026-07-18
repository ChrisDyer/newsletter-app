import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { APP_DESTINATIONS, CURRENT_APP_ID, CURRENT_APP_LABEL } from '../src/appShell/destinations.js'

const expected = [
  ['dashboard', 'Dashboard', 'https://zo-bot.com/'],
  ['finance', 'Finance', 'https://zo-bot.com/finance/'],
  ['travel', 'Travel', 'https://zo-bot.com/travel/'],
  ['newsletters', 'Newsletters', 'https://zo-bot.com/newsletter/'],
  ['home', 'Home', 'https://home.zo-bot.com/'],
  ['records', 'Records', 'https://zo-bot.com/records/'],
]

test('canonical destination manifest matches the site-wide contract', () => {
  assert.deepEqual(APP_DESTINATIONS.map(item => [item.id, item.label, item.href]), expected)
  assert.equal(CURRENT_APP_ID, 'newsletters')
  assert.equal(CURRENT_APP_LABEL, 'Newsletters')
  assert.equal(APP_DESTINATIONS.filter(item => item.id === CURRENT_APP_ID).length, 1)
  assert.throws(() => { APP_DESTINATIONS.push({ id: 'extra' }) }, TypeError)
})

test('app switcher is present in inbox and reader chrome', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const sidebar = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8')
  const reader = await readFile(new URL('../src/components/ReaderPage.jsx', import.meta.url), 'utf8')

  assert.match(app, /<AppSwitcher placement="mobile-header" \/>/)
  assert.match(sidebar, /<AppSwitcher placement="sidebar" \/>/)
  assert.match(reader, /<AppSwitcher placement="reader-toolbar" \/>/)
  assert.doesNotMatch(sidebar, /Zo-Bot Home/)
})

test('app switcher follows the canonical presentation appendix', async () => {
  const switcher = await readFile(new URL('../src/appShell/AppSwitcher.jsx', import.meta.url), 'utf8')

  // Canonical glyph set embedded as lucide path data.
  assert.ok(switcher.includes('M17.8 19.2 16 11l3.5-3.5'), 'plane glyph')
  assert.ok(switcher.includes('m22 7-8.991 5.727'), 'mail glyph')
  assert.ok(switcher.includes('M14 2v5a1 1 0 0 0 1 1h5'), 'file-text glyph')
  // Dark slate-950 dropdown surface in both placements; no light menu variant.
  assert.match(switcher, /bg-slate-950/)
  assert.doesNotMatch(switcher, /w-64 rounded-md border border-slate-200 bg-white/)
  // Every destination, current app included, is a real link — no inert button branch.
  assert.doesNotMatch(switcher, /selectCurrentApp/)
  assert.match(switcher, /aria-current=\{current \? 'page' : undefined\}/)
  // Reader keeps its compact placement.
  assert.match(switcher, /reader-toolbar/)
})

test('protected newsletter behaviors remain in source', async () => {
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  const preview = await readFile(new URL('../src/components/PreviewPane.jsx', import.meta.url), 'utf8')
  const reader = await readFile(new URL('../src/components/ReaderPage.jsx', import.meta.url), 'utf8')

  assert.doesNotMatch(app, /window\.confirm/)
  assert.match(app, /role="dialog"/)
  assert.match(app, /aria-modal="true"/)
  assert.match(preview, /sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"/)
  assert.match(reader, /sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"/)
  assert.match(preview, /referrerPolicy="no-referrer"/)
  assert.match(reader, /referrerPolicy="no-referrer"/)
})