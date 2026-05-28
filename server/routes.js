import { syncNewsletters } from './sync.js'
import { toReaderHtml } from './readability.js'

export function registerRoutes(app, db) {
  app.get('/api/newsletters', (req, res) => {
    const page = Math.max(0, parseInt(req.query.page) || 0)
    const rows = db.prepare(`
      SELECT id, gmail_id, from_name, from_email, subject, date, snippet
      FROM newsletters
    `).all()
    rows.sort((a, b) => new Date(b.date) - new Date(a.date))

    const dayMs = 86400000
    const now = Date.now()
    const pageEnd = now - page * 7 * dayMs
    const pageStart = now - (page + 1) * 7 * dayMs

    const newsletters = rows.filter(n => {
      const t = new Date(n.date).getTime()
      return t >= pageStart && t <= pageEnd
    })
    const hasMore = rows.some(n => new Date(n.date).getTime() < pageStart)

    res.json({ newsletters, page, hasMore })
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
