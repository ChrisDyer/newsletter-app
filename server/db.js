import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

export function initDb(dbPath) {
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS newsletters (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail_id     TEXT NOT NULL UNIQUE,
      thread_id    TEXT,
      from_name    TEXT,
      from_email   TEXT,
      subject      TEXT,
      date         TEXT,
      snippet      TEXT,
      body_html    TEXT,
      body_text    TEXT,
      synced_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_nl_date       ON newsletters(date);
    CREATE INDEX IF NOT EXISTS idx_nl_from_email ON newsletters(from_email);
  `)

  return db
}
