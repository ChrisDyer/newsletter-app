import webpush from 'web-push'
import { createHash } from 'node:crypto'

const services = new WeakMap()
const PUSH_HOSTS = new Set(['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'])
// Apple decodes Topic as base64url, rather than only checking its alphabet.
// A 32-character digest prefix encodes 24 bytes with no padding or trailing bits.
const UNREAD_TOPIC = createHash('sha256').update('newsletter-unread').digest('base64url').slice(0, 32)

function pushErrorReason(error) {
  try {
    const reason = JSON.parse(error.body).reason
    if (typeof reason === 'string' && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(reason)) return reason
  } catch { /* Never log arbitrary error bodies or subscription credentials. */ }
  return null
}

export function validSubscription(value) {
  try {
    const url = new URL(value?.endpoint)
    if (value.endpoint.length > 2048 || url.protocol !== 'https:' || !PUSH_HOSTS.has(url.hostname) || url.port || url.username || url.password || url.hash) return false
    const keys = value.keys
    return /^[\w-]{87}$/.test(keys?.p256dh) && /^[\w-]{22}$/.test(keys?.auth)
      && Buffer.from(keys.p256dh, 'base64url')[0] === 4
  } catch { return false }
}

export function getPushService(db) {
  if (!services.has(db)) services.set(db, createPushService(db))
  return services.get(db)
}

// All credentials stay in the existing, backed-up database. No Apple account or
// additional production secret is needed. Never rotate the VAPID key on restart.
export function createPushService(db, { send = webpush.sendNotification.bind(webpush), debounceMs = 2000 } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_settings (id INTEGER PRIMARY KEY CHECK(id = 1), vapid TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY, owner TEXT NOT NULL, subscription TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_badge (
      id INTEGER PRIMARY KEY CHECK(id = 1), unread INTEGER NOT NULL, revision INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO push_badge VALUES (1, -1, 0);
  `)
  let keys = db.prepare('SELECT vapid FROM push_settings WHERE id = 1').get()
  if (!keys) {
    db.prepare('INSERT OR IGNORE INTO push_settings VALUES (1, ?)').run(JSON.stringify(webpush.generateVAPIDKeys()))
    keys = db.prepare('SELECT vapid FROM push_settings WHERE id = 1').get()
  }
  const vapid = JSON.parse(keys.vapid)
  const badge = () => {
    const unread = db.prepare('SELECT COUNT(*) AS n FROM newsletters WHERE read_at IS NULL AND archived_at IS NULL').get().n
    db.prepare('UPDATE push_badge SET unread = ?, revision = MAX(revision + 1, ?) WHERE id = 1 AND unread != ?').run(unread, Date.now(), unread)
    return db.prepare('SELECT unread, revision FROM push_badge WHERE id = 1').get()
  }
  let timer
  let queue = Promise.resolve()
  let pendingAdded = 0
  const broadcast = async (added) => {
    const state = badge()
    // New Safari can display this fallback even if a worker has been evicted.
    // Older browsers use the same payload through our service worker.
    const payload = JSON.stringify({
      ...state, added, web_push: 8030,
      notification: {
        title: 'Newsletters',
        body: state.unread ? `${state.unread} unread ${state.unread === 1 ? 'newsletter' : 'newsletters'}` : 'You’re all caught up.',
        navigate: 'https://newsletter.zo-bot.com/?filter=unread',
        tag: 'newsletter-unread', app_badge: String(state.unread),
      },
    })
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    for (const row of db.prepare('SELECT * FROM push_subscriptions').all()) {
      // Revoked write access also revokes delivery to previously enabled devices.
      if (admins.length && !admins.includes(row.owner)) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(row.endpoint)
        continue
      }
      try {
        await send(JSON.parse(row.subscription), payload, {
          vapidDetails: { subject: 'https://newsletter.zo-bot.com', ...vapid },
          TTL: 86400, topic: UNREAD_TOPIC, urgency: 'normal', timeout: 10000,
        })
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND subscription = ?').run(row.endpoint, row.subscription)
        } else {
          // Endpoint URLs and subscription keys are credentials; don't log them.
          console.warn('[push] delivery failed:', error.statusCode || error.code || 'unknown', pushErrorReason(error) || '')
        }
      }
    }
  }
  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    const added = pendingAdded
    pendingAdded = 0
    queue = queue.then(() => broadcast(added)).catch(() => console.warn('[push] broadcast failed'))
    return queue
  }
  badge()
  return {
    publicKey: vapid.publicKey,
    badge,
    changed(added = 0) {
      const previous = db.prepare('SELECT unread FROM push_badge WHERE id = 1').get().unread
      if (badge().unread === previous && !added) return
      pendingAdded += added
      clearTimeout(timer)
      timer = setTimeout(flush, debounceMs)
      timer.unref?.()
    },
    flush,
  }
}

export function registerPushRoutes(app, db, push) {
  app.get('/api/push/config', (req, res) => {
    res.set('Cache-Control', 'no-store').json({ publicKey: push.publicKey })
  })
  // Subscription management inherits the existing Access + admin write gate.
  app.post('/api/push/subscription', (req, res) => {
    if (!req.userEmail || req.readOnly) return res.status(403).json({ error: 'Sign in with a writable account to enable notifications.' })
    const subscription = req.body
    if (!validSubscription(subscription)) return res.status(400).json({ error: 'Invalid push subscription.' })
    const existing = db.prepare('SELECT owner FROM push_subscriptions WHERE endpoint = ?').get(subscription.endpoint)
    if (existing && existing.owner !== req.userEmail) return res.status(409).json({ error: 'This device is subscribed under another account. Disable its notifications first.' })
    const count = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE owner = ?').get(req.userEmail).n
    if (!existing && count >= 20) return res.status(409).json({ error: 'Too many subscribed devices. Disable notifications on an old device first.' })
    // Store only the browser-provided fields needed for encrypted Web Push.
    const safe = { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } }
    db.prepare(`INSERT INTO push_subscriptions VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription, updated_at = excluded.updated_at`)
      .run(safe.endpoint, req.userEmail, JSON.stringify(safe), Date.now())
    res.json({ ok: true, ...push.badge() })
  })
  app.delete('/api/push/subscription', (req, res) => {
    if (!req.userEmail || req.readOnly) return res.status(403).json({ error: 'Forbidden' })
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND owner = ?').run(req.body?.endpoint || '', req.userEmail)
    res.json({ ok: true })
  })
}
