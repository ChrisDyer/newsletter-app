import { syncNewsletters } from './sync.js'
import { toReaderHtml } from './readability.js'

export function registerRoutes(app, db) {
  const PAGE_SIZE = 25

  app.get('/api/newsletters', (req, res) => {
    const page = Math.max(0, parseInt(req.query.page) || 0)
    const offset = page * PAGE_SIZE

    // Sort on internal_date (reliable epoch-ms from Gmail). Rows are never dropped for a
    // bad Date: header any more — backfill guarantees every row has an internal_date.
    const newsletters = db.prepare(`
      SELECT id, gmail_id, from_name, from_email, subject, date, snippet
      FROM newsletters
      ORDER BY internal_date DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(PAGE_SIZE, offset)

    const total = db.prepare('SELECT COUNT(*) AS n FROM newsletters').get().n
    const hasMore = offset + newsletters.length < total

    res.json({ newsletters, page, hasMore, total, pageSize: PAGE_SIZE })
  })

  // Compact counts for the cross-app homepage dashboard.
  app.get('/api/summary', (req, res) => {
    const total = db.prepare('SELECT COUNT(*) AS n FROM newsletters').get().n
    const weekAgo = Date.now() - 7 * 86400000
    const recent = db.prepare('SELECT COUNT(*) AS n FROM newsletters WHERE internal_date >= ?').get(weekAgo).n
    res.json({ total, recent })
  })

  app.get('/api/newsletters/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM newsletters WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json({ ...row, reader_html: toReaderHtml(row.body_html, row.body_text, { fromName: row.from_name, date: row.date }) })
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
