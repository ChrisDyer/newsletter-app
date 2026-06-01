import 'dotenv/config'
import { getGmailClient, listMessageIds, fetchMessage } from './gmail.js'
import { readingMinutes } from './db.js'

// Shared guard so a scheduled auto-sync and a manual sync can't run concurrently.
let running = false

export async function syncNewsletters(db) {
  if (running) return { total: 0, added: 0, failed: 0, skipped: true }
  running = true
  try {
    return await runSync(db)
  } finally {
    running = false
  }
}

async function runSync(db) {
  const label = process.env.NEWSLETTER_LABEL || 'Newsletters'
  const gmail = getGmailClient()
  const ids = await listMessageIds(gmail, label)

  const existingRows = db.prepare('SELECT gmail_id FROM newsletters').all()
  const existing = new Set(existingRows.map(r => r.gmail_id))
  const newIds = ids.filter(id => !existing.has(id))

  const insert = db.prepare(`
    INSERT OR IGNORE INTO newsletters
      (gmail_id, thread_id, from_name, from_email, subject, date, internal_date, snippet, body_html, body_text, reading_minutes)
    VALUES
      (@gmail_id, @thread_id, @from_name, @from_email, @subject, @date, @internal_date, @snippet, @body_html, @body_text, @reading_minutes)
  `)

  let added = 0
  let failed = 0
  for (const id of newIds) {
    // One bad message (fetch error, malformed payload) must not abort the whole sync —
    // log it and keep going so the remaining new messages still land.
    try {
      const msg = await fetchMessage(gmail, id)
      msg.reading_minutes = readingMinutes(msg.body_text)
      insert.run(msg)
      added++
      console.log(`[sync] +${added}/${newIds.length}: ${msg.subject}`)
    } catch (err) {
      failed++
      console.warn(`[sync] skipped message ${id}: ${err.message}`)
    }
  }

  return { total: ids.length, added, failed }
}
