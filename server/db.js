import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

export function initDb(dbPath) {
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletters (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail_id      TEXT NOT NULL UNIQUE,
      thread_id     TEXT,
      from_name     TEXT,
      from_email    TEXT,
      subject       TEXT,
      date          TEXT,
      internal_date INTEGER,
      snippet       TEXT,
      body_html     TEXT,
      body_text     TEXT,
      synced_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_nl_from_email ON newsletters(from_email);
  `)

  migrateInternalDate(db)

  return db
}

// internal_date (epoch-ms) was added after launch. Older DBs created with the original
// schema lack the column; add it, backfill, and (re)create the sort index. Idempotent.
function migrateInternalDate(db) {
  const cols = db.prepare('PRAGMA table_info(newsletters)').all()
  const hasInternalDate = cols.some(c => c.name === 'internal_date')
  if (!hasInternalDate) {
    db.exec('ALTER TABLE newsletters ADD COLUMN internal_date INTEGER')
  }

  // Drop the old index on the unsortable freeform `date` string if it exists, and index
  // the reliable epoch column instead.
  db.exec(`
    DROP INDEX IF EXISTS idx_nl_date;
    CREATE INDEX IF NOT EXISTS idx_nl_internal_date ON newsletters(internal_date DESC);
  `)

  // Backfill rows missing internal_date: parse the Date: header where possible, else fall
  // back to synced_at so the row still sorts somewhere sensible instead of disappearing.
  const rows = db.prepare(
    'SELECT id, date, synced_at FROM newsletters WHERE internal_date IS NULL'
  ).all()
  if (rows.length === 0) return

  const update = db.prepare('UPDATE newsletters SET internal_date = ? WHERE id = ?')
  const backfill = db.transaction((items) => {
    for (const r of items) {
      const fromHeader = r.date ? Date.parse(r.date) : NaN
      const fromSynced = r.synced_at ? Date.parse(r.synced_at) : NaN
      const epoch = Number.isFinite(fromHeader)
        ? fromHeader
        : (Number.isFinite(fromSynced) ? fromSynced : 0)
      update.run(epoch, r.id)
    }
  })
  backfill(rows)
}
