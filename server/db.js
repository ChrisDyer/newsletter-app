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
  migrateReaderFeatures(db)

  return db
}

// Estimate reading time at ~200 words/min. Null for empty bodies so the UI can hide it.
export function readingMinutes(text) {
  if (!text) return null
  const words = text.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return null
  return Math.max(1, Math.ceil(words / 200))
}

// Reader features added after launch: read/archive/star state, reading-time, and a
// full-text search index. All idempotent so it's safe to run on every startup.
function migrateReaderFeatures(db) {
  const cols = db.prepare('PRAGMA table_info(newsletters)').all().map(c => c.name)
  const addCol = (name, ddl) => { if (!cols.includes(name)) db.exec(`ALTER TABLE newsletters ADD COLUMN ${ddl}`) }
  addCol('read_at', 'read_at TEXT')
  addCol('archived_at', 'archived_at TEXT')
  addCol('starred', 'starred INTEGER NOT NULL DEFAULT 0')
  addCol('reading_minutes', 'reading_minutes INTEGER')

  // Backfill reading_minutes BEFORE the FTS triggers exist so we don't churn the index.
  const missing = db.prepare('SELECT id, body_text FROM newsletters WHERE reading_minutes IS NULL').all()
  if (missing.length) {
    const upd = db.prepare('UPDATE newsletters SET reading_minutes = ? WHERE id = ?')
    db.transaction(rows => { for (const r of rows) upd.run(readingMinutes(r.body_text), r.id) })(missing)
  }

  // Plain FTS5 index (stores its own copy of the text) over the searchable columns, kept
  // in sync via triggers. A plain table supports DELETE BY rowid, which avoids the fragile
  // 'delete' command external-content tables require.
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS newsletters_fts USING fts5(
      subject, from_name, from_email, body_text
    );
    CREATE TRIGGER IF NOT EXISTS nl_fts_ai AFTER INSERT ON newsletters BEGIN
      INSERT INTO newsletters_fts(rowid, subject, from_name, from_email, body_text)
      VALUES (new.id, new.subject, new.from_name, new.from_email, new.body_text);
    END;
    CREATE TRIGGER IF NOT EXISTS nl_fts_ad AFTER DELETE ON newsletters BEGIN
      DELETE FROM newsletters_fts WHERE rowid = old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS nl_fts_au AFTER UPDATE ON newsletters BEGIN
      DELETE FROM newsletters_fts WHERE rowid = old.id;
      INSERT INTO newsletters_fts(rowid, subject, from_name, from_email, body_text)
      VALUES (new.id, new.subject, new.from_name, new.from_email, new.body_text);
    END;
  `)

  // Populate the index from existing rows once (empty on first creation).
  const ftsCount = db.prepare('SELECT COUNT(*) AS n FROM newsletters_fts').get().n
  if (ftsCount === 0) {
    db.exec(`
      INSERT INTO newsletters_fts(rowid, subject, from_name, from_email, body_text)
      SELECT id, subject, from_name, from_email, body_text FROM newsletters
    `)
  }
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
