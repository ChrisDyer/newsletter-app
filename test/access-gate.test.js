import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import express from 'express'
import { accessGate } from '../server/accessGate.js'
import { initDb } from '../server/db.js'
import { registerRoutes } from '../server/routes.js'

const originalEnv = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  Object.assign(process.env, originalEnv)
}

async function withServer(env, fn) {
  restoreEnv()
  Object.assign(process.env, env)

  const dir = await mkdtemp(path.join(tmpdir(), 'newsletter-role-'))
  const db = initDb(path.join(dir, 'newsletters.db'))
  const app = express()
  app.use(express.json())
  app.use(accessGate)
  registerRoutes(app, db)

  const server = await new Promise(resolve => {
    const instance = app.listen(0, () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`

  try {
    return await fn({ baseUrl, db })
  } finally {
    await new Promise(resolve => server.close(resolve))
    db.close()
    await rm(dir, { recursive: true, force: true })
    restoreEnv()
  }
}

function seedNewsletter(db) {
  const info = db.prepare(`
    INSERT INTO newsletters (gmail_id, thread_id, from_name, from_email, subject, date, internal_date, snippet, body_html, body_text, reading_minutes)
    VALUES ('g1', 't1', 'Sender', 'sender@example.com', 'Subject', '2026-07-20', 1784592000000, 'Snippet', '<p>Hello</p>', 'Hello', 1)
  `).run()
  return info.lastInsertRowid
}

async function request(baseUrl, route, options = {}) {
  return fetch(`${baseUrl}${route}`, options)
}

test('read-only users cannot POST when ADMIN_EMAILS is configured', async () => {
  await withServer({ ADMIN_EMAILS: 'chrissdyer@gmail.com' }, async ({ baseUrl, db }) => {
    seedNewsletter(db)
    const res = await request(baseUrl, '/api/newsletters/read-all', {
      method: 'POST',
      headers: { 'cf-access-authenticated-user-email': 'kate@example.com' },
    })
    assert.equal(res.status, 403)
    assert.equal((await res.json()).error, 'read_only')
  })
})

test('admin users can POST when ADMIN_EMAILS is configured', async () => {
  await withServer({ ADMIN_EMAILS: 'chrissdyer@gmail.com' }, async ({ baseUrl, db }) => {
    seedNewsletter(db)
    const res = await request(baseUrl, '/api/newsletters/read-all', {
      method: 'POST',
      headers: { 'cf-access-authenticated-user-email': 'chrissdyer@gmail.com' },
    })
    assert.notEqual(res.status, 403)
    assert.equal(res.status, 200)
  })
})

test('internal-token requests bypass read-only enforcement', async () => {
  await withServer({ ADMIN_EMAILS: 'chrissdyer@gmail.com', INTERNAL_API_TOKEN: 'secret' }, async ({ baseUrl, db }) => {
    seedNewsletter(db)
    const res = await request(baseUrl, '/api/newsletters/read-all', {
      method: 'POST',
      headers: { 'x-internal-token': 'secret' },
    })
    assert.equal(res.status, 200)
  })
})

test('unset ADMIN_EMAILS leaves all authenticated users writable', async () => {
  await withServer({ ADMIN_EMAILS: '' }, async ({ baseUrl, db }) => {
    seedNewsletter(db)
    const res = await request(baseUrl, '/api/newsletters/read-all', {
      method: 'POST',
      headers: { 'cf-access-authenticated-user-email': 'kate@example.com' },
    })
    assert.equal(res.status, 200)
  })
})

test('GET /api/me reports email and readOnly role', async () => {
  await withServer({ ADMIN_EMAILS: 'chrissdyer@gmail.com' }, async ({ baseUrl }) => {
    const res = await request(baseUrl, '/api/me', {
      headers: { 'cf-access-authenticated-user-email': 'kate@example.com' },
    })
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { email: 'kate@example.com', readOnly: true })
  })
})

test('read-only GET /api/newsletters/:id does not mark read', async () => {
  await withServer({ ADMIN_EMAILS: 'chrissdyer@gmail.com' }, async ({ baseUrl, db }) => {
    const id = seedNewsletter(db)
    const res = await request(baseUrl, `/api/newsletters/${id}`, {
      headers: { 'cf-access-authenticated-user-email': 'kate@example.com' },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.newly_read, false)
    assert.equal(db.prepare('SELECT read_at FROM newsletters WHERE id = ?').get(id).read_at, null)
  })
})

test('admin GET /api/newsletters/:id still marks read', async () => {
  await withServer({ ADMIN_EMAILS: 'chrissdyer@gmail.com' }, async ({ baseUrl, db }) => {
    const id = seedNewsletter(db)
    const res = await request(baseUrl, `/api/newsletters/${id}`, {
      headers: { 'cf-access-authenticated-user-email': 'chrissdyer@gmail.com' },
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.newly_read, true)
    assert.ok(db.prepare('SELECT read_at FROM newsletters WHERE id = ?').get(id).read_at)
  })
})
