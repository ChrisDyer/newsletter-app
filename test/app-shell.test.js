import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('standalone identity replaces the global switcher in inbox and reader', async () => {
  for (const [file, placement] of [['App.jsx','mobile-header'], ['components/Sidebar.jsx','sidebar'], ['components/ReaderPage.jsx','reader-toolbar']]) {
    const source = await readFile(new URL('../src/' + file, import.meta.url), 'utf8')
    assert.ok(source.includes('<AppIdentity placement="' + placement + '" />'))
  }
  const identity = await readFile(new URL('../src/appShell/AppIdentity.jsx', import.meta.url), 'utf8')
  assert.ok(identity.includes('aria-label="Newsletters"'))
  assert.doesNotMatch(identity, /aria-haspopup|role="menu"|zo-bot.com/)
})

test('install manifest has an independent root identity', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  assert.equal(manifest.id, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.start_url, '/?standalone=20261101')
  assert.equal(manifest.name, 'Newsletters')
  assert.equal(manifest.display, 'standalone')
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