import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createECDH, randomBytes } from 'node:crypto'
import vm from 'node:vm'
import test from 'node:test'
import express from 'express'
import webpush from 'web-push'
import { initDb } from '../server/db.js'
import { accessGate } from '../server/accessGate.js'
import { createPushService, registerPushRoutes, validSubscription } from '../server/push.js'
import { registerRoutes } from '../server/routes.js'

function subscription(id = 'one') {
  const curve = createECDH('prime256v1')
  curve.generateKeys()
  return {
    endpoint: `https://web.push.apple.com/${id}`,
    keys: { p256dh: curve.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
  }
}
function seed(db, id, { read = false, archived = false } = {}) {
  db.prepare('INSERT INTO newsletters (gmail_id, read_at, archived_at) VALUES (?, ?, ?)')
    .run(id, read ? '2026-11-01' : null, archived ? '2026-11-01' : null)
}
function save(db, sub, owner = 'chris@example.com') {
  db.prepare('INSERT INTO push_subscriptions VALUES (?, ?, ?, ?)').run(sub.endpoint, owner, JSON.stringify(sub), Date.now())
}

test('push credentials persist; notifications carry absolute non-archived unread count, coalesce and clear', async () => {
  const db = initDb(':memory:')
  const sent = []
  const push = createPushService(db, { send: async (...args) => sent.push(args) })
  const key = push.publicKey
  assert.equal(createPushService(db).publicKey, key)
  save(db, subscription())
  seed(db, 'unread')
  seed(db, 'read', { read: true })
  seed(db, 'archived', { archived: true })
  push.changed(1)
  push.changed()
  await push.flush()
  assert.equal(sent.length, 1)
  const first = JSON.parse(sent[0][1])
  assert.equal(first.unread, 1)
  assert.equal(first.added, 1)
  assert.equal(first.web_push, 8030)
  assert.equal(first.notification.app_badge, '1')
  assert.equal(sent[0][2].vapidDetails.publicKey, key)
  assert.equal(sent[0][2].topic, 'newsletter-unread')
  const encrypted = webpush.generateRequestDetails(...sent[0])
  assert.equal(encrypted.headers['Content-Encoding'], 'aes128gcm')
  assert.ok(encrypted.body.length > 0)
  db.prepare("UPDATE newsletters SET read_at = 'now' WHERE gmail_id = 'unread'").run()
  push.changed()
  await push.flush()
  const last = JSON.parse(sent.at(-1)[1])
  assert.equal(last.unread, 0)
  assert.ok(last.revision > first.revision)
  assert.equal(last.notification.app_badge, '0')
  db.close()
})

test('expired endpoints are pruned, transient failures retain subscriptions, remaining devices still receive pushes', async () => {
  const db = initDb(':memory:')
  const delivered = []
  const push = createPushService(db, { send: async sub => {
    if (sub.endpoint.endsWith('gone')) throw { statusCode: 410 }
    if (sub.endpoint.endsWith('busy')) throw { statusCode: 503 }
    delivered.push(sub.endpoint)
  } })
  save(db, subscription('gone'))
  save(db, subscription('busy'))
  save(db, subscription('working'))
  seed(db, 'new')
  push.changed(1)
  await push.flush()
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get().n, 2)
  assert.deepEqual(delivered, ['https://web.push.apple.com/working'])
  db.close()
})

test('subscription validation rejects arbitrary outbound targets and malformed encryption keys', () => {
  const sub = subscription()
  assert.equal(validSubscription(sub), true)
  for (const endpoint of ['https://127.0.0.1/internal', 'https://web.push.apple.com.evil.test/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com:444/x', 'https://user@web.push.apple.com/x']) {
    assert.equal(validSubscription({ ...sub, endpoint }), false)
  }
  assert.equal(validSubscription({ ...sub, keys: { auth: 'x', p256dh: 'x' } }), false)
  assert.equal(validSubscription(null), false)
})

test('subscription endpoints require auth, preserve roles and enforce device ownership', async () => {
  const before = { admins: process.env.ADMIN_EMAILS, bypass: process.env.ALLOW_NO_ACCESS_HEADER }
  process.env.ADMIN_EMAILS = 'chris@example.com,other@example.com'
  process.env.ALLOW_NO_ACCESS_HEADER = '0'
  const db = initDb(':memory:')
  const push = createPushService(db, { send: async () => {} })
  const app = express()
  app.use(express.json(), accessGate)
  registerPushRoutes(app, db, push)
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const sub = subscription()
  const call = (email, method = 'POST', body = sub) => fetch(`${url}/api/push/subscription`, {
    method, headers: { 'Content-Type': 'application/json', ...(email ? { 'cf-access-authenticated-user-email': email } : {}) }, body: JSON.stringify(body),
  })
  try {
    assert.equal((await call(null)).status, 403)
    assert.equal((await call('reader@example.com')).status, 403)
    assert.equal((await call('chris@example.com', 'POST', { ...sub, endpoint: 'https://localhost/private' })).status, 400)
    assert.equal((await call('chris@example.com')).status, 200)
    assert.equal((await call('chris@example.com')).status, 200)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get().n, 1)
    assert.equal((await call('other@example.com')).status, 409)
    assert.equal((await call('other@example.com', 'DELETE', { endpoint: sub.endpoint })).status, 200)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get().n, 1)
    assert.equal((await call('chris@example.com', 'DELETE', { endpoint: sub.endpoint })).status, 200)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get().n, 0)
  } finally {
    await new Promise(resolve => server.close(resolve))
    db.close()
    for (const [key, value] of [['ADMIN_EMAILS', before.admins], ['ALLOW_NO_ACCESS_HEADER', before.bypass]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('reading, mark-unread, archive, restore and read-all expose matching badge revisions', async () => {
  const db = initDb(':memory:')
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => { req.userEmail = 'chris@example.com'; next() })
  registerRoutes(app, db)
  seed(db, 'first')
  seed(db, 'second')
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const counts = () => fetch(`${base}/api/counts`).then(res => res.json())
  const mutate = (route, body) => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    const initial = await counts()
    assert.equal(initial.unread, 2)
    await fetch(`${base}/api/newsletters/1?mark_read=0`)
    assert.equal((await counts()).revision, initial.revision)
    await fetch(`${base}/api/newsletters/1`)
    const read = await counts()
    assert.equal(read.unread, 1)
    assert.ok(read.revision > initial.revision)
    await mutate('/api/newsletters/1/read', { read: false })
    assert.equal((await counts()).unread, 2)
    await mutate('/api/newsletters/1/archive', { archived: true })
    assert.equal((await counts()).unread, 1)
    await mutate('/api/newsletters/1/archive', { archived: false })
    assert.equal((await counts()).unread, 2)
    await mutate('/api/newsletters/read-all', {})
    const last = await counts()
    assert.equal(last.unread, 0)
    await mutate('/api/newsletters/1/read', { read: true })
    assert.equal((await counts()).revision, last.revision)
  } finally {
    await new Promise(resolve => server.close(resolve))
    db.close()
  }
})

async function workerHarness({ badgeFails = false } = {}) {
  const handlers = new Map()
  const badges = []
  const notices = []
  let persisted
  const indexedDB = {
    open() {
      const request = {}
      queueMicrotask(() => {
        request.result = { close() {}, transaction() {
          const tx = { objectStore() { return {
            get() {
              const read = {}
              queueMicrotask(() => { read.result = persisted; read.onsuccess(); queueMicrotask(() => tx.oncomplete()) })
              return read
            },
            put(value) { persisted = value },
          } } }
          return tx
        } }
        request.onsuccess()
      })
      return request
    },
  }
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    registration: { showNotification: async (title, options) => notices.push({ title, ...options }) },
    clients: { matchAll: async () => [] },
  }
  vm.runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self, indexedDB, navigator: { setAppBadge: async count => {
      if (badgeFails) throw new Error('Permission denied')
      badges.push(count)
    } }, URL,
  })
  return {
    badges, notices,
    async dispatch(name, data) {
      let work
      handlers.get(name)({ data: name === 'push' ? { json: () => data } : data, waitUntil: promise => { work = promise } })
      await work
    },
  }
}

test('worker updates while closed, ignores stale counts, always shows push notifications and clears zero', async () => {
  const worker = await workerHarness()
  await worker.dispatch('push', { unread: 8, revision: 3 })
  await worker.dispatch('message', { type: 'NEWSLETTER_BADGE', unread: 2, revision: 4 })
  await worker.dispatch('push', { unread: 6, revision: 2 })
  await worker.dispatch('push', { unread: 0, revision: 5 })
  assert.deepEqual(worker.badges, [8, 2, 2, 0])
  assert.equal(worker.notices.length, 3)
  assert.equal(worker.notices[1].body, '2 unread newsletters')
  assert.equal(worker.notices[2].body, 'You’re all caught up.')
  assert.equal(worker.notices[0].data.url, '/?filter=unread')
})

test('worker still displays a notification for an invalid payload', async () => {
  const worker = await workerHarness()
  await worker.dispatch('push', null)
  assert.equal(worker.notices.length, 1)
  assert.equal(worker.badges.length, 0)
})

test('badge API failure never prevents the required visible push notification', async () => {
  const worker = await workerHarness({ badgeFails: true })
  await worker.dispatch('push', { unread: 4, revision: 1 })
  assert.equal(worker.notices.length, 1)
  assert.equal(worker.notices[0].body, '4 unread newsletters')
})
