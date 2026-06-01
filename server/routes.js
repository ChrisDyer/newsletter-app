import { syncNewsletters } from './sync.js'
import { toReaderHtml } from './readability.js'

const LIST_FIELDS = `n.id, n.gmail_id, n.from_name, n.from_email, n.subject, n.date, n.internal_date,
  n.snippet, n.read_at, n.starred, n.archived_at, n.reading_minutes`

// Build the WHERE clause + params shared by the list and its count, from filter/sender.
// All columns are qualified with `n.` because the FTS join exposes overlapping names.
function buildFilter(req) {
  const filter = req.query.filter || 'all' // all | unread | starred | archived
  const sender = (req.query.sender || '').trim()
  const clauses = []
  const params = []

  // Archived rows are hidden everywhere except the explicit "archived" view.
  clauses.push(filter === 'archived' ? 'n.archived_at IS NOT NULL' : 'n.archived_at IS NULL')
  if (filter === 'unread') clauses.push('n.read_at IS NULL')
  if (filter === 'starred') clauses.push('n.starred = 1')
  if (sender) { clauses.push('n.from_email = ?'); params.push(sender) }

  return { where: clauses.join(' AND '), params }
}

// Turn free text into a safe FTS5 prefix query: each token quoted and prefix-matched (AND).
function ftsQuery(q) {
  return q.split(/\s+/).filter(Boolean)
    .map(t => '"' + t.replace(/"/g, '""') + '"*')
    .join(' ')
}

export function registerRoutes(app, db) {
  const PAGE_SIZE = 25

  app.get('/api/newsletters', (req, res) => {
    const page = Math.max(0, parseInt(req.query.page) || 0)
    const offset = page * PAGE_SIZE
    const q = (req.query.q || '').trim()
    const { where, params } = buildFilter(req)

    let rows, total
    if (q) {
      const match = ftsQuery(q)
      rows = db.prepare(`
        SELECT ${LIST_FIELDS}
        FROM newsletters_fts
        JOIN newsletters n ON n.id = newsletters_fts.rowid
        WHERE newsletters_fts MATCH ? AND ${where}
        ORDER BY n.internal_date DESC, n.id DESC
        LIMIT ? OFFSET ?
      `).all(match, ...params, PAGE_SIZE, offset)
      total = db.prepare(`
        SELECT COUNT(*) AS n
        FROM newsletters_fts
        JOIN newsletters n ON n.id = newsletters_fts.rowid
        WHERE newsletters_fts MATCH ? AND ${where}
      `).get(match, ...params).n
    } else {
      rows = db.prepare(`
        SELECT ${LIST_FIELDS}
        FROM newsletters n
        WHERE ${where}
        ORDER BY n.internal_date DESC, n.id DESC
        LIMIT ? OFFSET ?
      `).all(...params, PAGE_SIZE, offset)
      total = db.prepare(`SELECT COUNT(*) AS n FROM newsletters n WHERE ${where}`).get(...params).n
    }

    const unread = db.prepare(
      'SELECT COUNT(*) AS n FROM newsletters WHERE read_at IS NULL AND archived_at IS NULL'
    ).get().n
    const hasMore = offset + rows.length < total

    res.json({ newsletters: rows, page, hasMore, total, unread, pageSize: PAGE_SIZE })
  })

  // Distinct senders for the sidebar filter, with total + unread counts.
  app.get('/api/senders', (req, res) => {
    const rows = db.prepare(`
      SELECT from_email,
             MAX(from_name) AS from_name,
             COUNT(*) AS total,
             SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread
      FROM newsletters
      WHERE archived_at IS NULL AND from_email IS NOT NULL AND from_email != ''
      GROUP BY from_email
      ORDER BY total DESC
    `).all()
    res.json(rows)
  })

  // Compact counts for the cross-app homepage dashboard.
  app.get('/api/summary', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM newsletters').get().n
    const weekAgo = Date.now() - 7 * 86400000
    const recent = db.prepare('SELECT COUNT(*) AS n FROM newsletters WHERE internal_date >= ?').get(weekAgo).n
    const unread = db.prepare('SELECT COUNT(*) AS n FROM newsletters WHERE read_at IS NULL AND archived_at IS NULL').get().n
    res.json({ total, recent, unread })
  })

  app.get('/api/newsletters/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    // Mark read on open.
    const newly_read = !row.read_at
    if (newly_read) {
      const now = new Date().toISOString()
      db.prepare('UPDATE newsletters SET read_at = ? WHERE id = ?').run(now, row.id)
      row.read_at = now
    }
    res.json({ ...row, newly_read, reader_html: toReaderHtml(row.body_html, row.body_text, { fromName: row.from_name, date: row.date }) })
  })

  // ── State toggles ────────────────────────────────────────────────────────────

  // Mark every unread newsletter as read. Defined before the :id routes so the literal
  // "read-all" path can't be swallowed by a param match.
  app.post('/api/newsletters/read-all', (req, res) => {
    const info = db.prepare('UPDATE newsletters SET read_at = ? WHERE read_at IS NULL')
      .run(new Date().toISOString())
    res.json({ ok: true, updated: info.changes })
  })

  app.post('/api/newsletters/:id/star', (req, res) => {
    const row = db.prepare('SELECT starred FROM newsletters WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    const starred = row.starred ? 0 : 1
    db.prepare('UPDATE newsletters SET starred = ? WHERE id = ?').run(starred, req.params.id)
    res.json({ id: Number(req.params.id), starred })
  })

  app.post('/api/newsletters/:id/read', (req, res) => {
    const read = req.body?.read !== false // default true; pass { read: false } to mark unread
    db.prepare('UPDATE newsletters SET read_at = ? WHERE id = ?')
      .run(read ? new Date().toISOString() : null, req.params.id)
    res.json({ id: Number(req.params.id), read })
  })

  app.post('/api/newsletters/:id/archive', (req, res) => {
    const archived = req.body?.archived !== false // default true; { archived: false } to restore
    db.prepare('UPDATE newsletters SET archived_at = ? WHERE id = ?')
      .run(archived ? new Date().toISOString() : null, req.params.id)
    res.json({ id: Number(req.params.id), archived })
  })

  let syncing = false
  app.post('/api/sync', async (req, res) => {
    if (syncing) return res.status(409).json({ error: 'Sync already in progress' })
    syncing = true
    try {
      const result = await syncNewsletters(db)
      const lastSync = new Date().toISOString()
      res.json({ ...result, lastSync })
    } catch (err) {
      console.error('[sync] error:', err)
      res.status(500).json({ error: err.message })
    } finally {
      syncing = false
    }
  })
}
