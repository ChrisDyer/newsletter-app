import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import express from 'express'
import { accessGate } from './server/accessGate.js'
import { initDb } from './server/db.js'
import { registerRoutes } from './server/routes.js'
import { syncNewsletters } from './server/sync.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Load .env by absolute path (not cwd) so env vars apply regardless of the working
// directory pm2 launches this process from.
dotenv.config({ path: path.join(__dirname, '.env') })

const PORT    = process.env.PORT || 3002
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'newsletters.db')

const app = express()
app.use(express.json())

// Defense-in-depth: this server.js is the production entrypoint (dev uses the Vite
// plugin), so it always sits behind Cloudflare Access. Require Cloudflare identity
// unless ALLOW_NO_ACCESS_HEADER=1, exempt same-VPS internal-token calls, and treat
// non-admin Access users as read-only when ADMIN_EMAILS is configured.
app.use(accessGate)

const db = initDb(DB_PATH)
registerRoutes(app, db)

app.use(express.static(path.join(__dirname, 'dist')))
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

app.listen(PORT, () => console.log(`Newsletter app running on http://localhost:${PORT}`))

// Background auto-sync so new newsletters appear without pressing Sync. The manual button
// still works; syncNewsletters() guards against overlap. Set SYNC_INTERVAL_MINUTES=0 to
// disable. Requires GMAIL_REFRESH_TOKEN — errors (e.g. missing creds) are logged, not fatal.
const SYNC_INTERVAL_MINUTES = process.env.SYNC_INTERVAL_MINUTES != null
  ? Number(process.env.SYNC_INTERVAL_MINUTES)
  : 360 // 6 hours
if (SYNC_INTERVAL_MINUTES > 0) {
  const intervalMs = SYNC_INTERVAL_MINUTES * 60_000
  const autoSync = async () => {
    try {
      const r = await syncNewsletters(db)
      if (!r.skipped) console.log(`[auto-sync] +${r.added} new (${r.total} in label, ${r.failed} failed)`)
    } catch (e) {
      console.warn('[auto-sync] error:', e.message)
    }
  }
  setTimeout(autoSync, 15_000)        // initial run shortly after startup
  setInterval(autoSync, intervalMs)   // then on a fixed cadence
}
