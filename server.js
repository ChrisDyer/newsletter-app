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

const db = initDb(DB_PATH)
registerRoutes(app, db)

app.use(express.static(path.join(__dirname, 'dist')))
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

app.listen(PORT, () => console.log(`Newsletter app running on http://localhost:${PORT}`))
