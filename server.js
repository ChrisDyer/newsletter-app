import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb } from './server/db.js'
import { registerRoutes } from './server/routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT    = process.env.PORT || 3002
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'newsletters.db')

const app = express()
app.use(express.json())

// Defense-in-depth: this server.js is the production entrypoint (dev uses the Vite
// plugin), so it always sits behind Cloudflare Access. Require the identity header
// Cloudflare injects; its absence means Access was bypassed/misconfigured. Set
// ALLOW_NO_ACCESS_HEADER=1 only to smoke-test the production build locally.
if (process.env.ALLOW_NO_ACCESS_HEADER !== '1') {
  app.use((req, res, next) => {
    if (!req.headers['cf-access-authenticated-user-email']) {
      return res.status(403).send('Forbidden')
    }
    next()
  })
}

const db = initDb(DB_PATH)
registerRoutes(app, db)

app.use(express.static(path.join(__dirname, 'dist')))
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

app.listen(PORT, () => console.log(`Newsletter app running on http://localhost:${PORT}`))
