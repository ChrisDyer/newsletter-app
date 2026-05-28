import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb } from './db.js'
import { registerRoutes } from './routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'newsletters.db')

export function newsletterPlugin() {
  const db = initDb(DB_PATH)
  const app = express()
  app.use(express.json())
  registerRoutes(app, db)
  return {
    name: 'newsletter-db',
    configureServer(server) {
      server.middlewares.use(app)
    },
  }
}
