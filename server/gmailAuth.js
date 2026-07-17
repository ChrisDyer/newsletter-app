import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { google } from 'googleapis'

const states = new Map()
const STATE_TTL_MS = 10 * 60_000

function appBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '')

  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const basePath = process.env.PUBLIC_BASE_PATH ?? (host?.startsWith('localhost') ? '' : '/newsletter')
  return `${proto}://${host}${basePath}`.replace(/\/$/, '')
}

function redirectUri(req) {
  if (process.env.GMAIL_OAUTH_REDIRECT_URI) return process.env.GMAIL_OAUTH_REDIRECT_URI
  return `${appBaseUrl(req)}/api/gmail/oauth/callback`
}

function oauthClient(req) {
  const { GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET } = process.env
  if (!GOOGLE_GMAIL_CLIENT_ID || !GOOGLE_GMAIL_CLIENT_SECRET) {
    throw new Error('Missing GOOGLE_GMAIL_CLIENT_ID or GOOGLE_GMAIL_CLIENT_SECRET')
  }
  return new google.auth.OAuth2(
    GOOGLE_GMAIL_CLIENT_ID,
    GOOGLE_GMAIL_CLIENT_SECRET,
    redirectUri(req),
  )
}

function assertAllowedAccessUser(req) {
  const allowed = (process.env.GMAIL_OAUTH_ALLOWED_EMAILS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
  if (!allowed.length) return

  const email = String(req.headers['cf-access-authenticated-user-email'] || '').toLowerCase()
  if (!allowed.includes(email)) {
    const err = new Error('This Cloudflare Access user is not allowed to reconnect Gmail.')
    err.status = 403
    throw err
  }
}

function pruneStates() {
  const now = Date.now()
  for (const [state, entry] of states) {
    if (entry.expiresAt <= now) states.delete(state)
  }
}

function callbackHtml(ok, message) {
  const title = ok ? 'Gmail reconnected' : 'Gmail reconnect failed'
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font:16px system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 24px;line-height:1.5">
<h1>${title}</h1>
<p>${message}</p>
<p><a href="../..">Return to newsletter</a></p>
</body></html>`
}

function persistRefreshToken(token) {
  const envPath = process.env.ENV_PATH || path.join(process.cwd(), '.env')
  let text = fs.readFileSync(envPath, 'utf8')
  const backupPath = `${envPath}.bak-gmail-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
  fs.copyFileSync(envPath, backupPath)

  if (/^GMAIL_REFRESH_TOKEN=/m.test(text)) {
    text = text.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, `GMAIL_REFRESH_TOKEN=${token}`)
  } else {
    text += `${text.endsWith('\n') ? '' : '\n'}GMAIL_REFRESH_TOKEN=${token}\n`
  }

  fs.writeFileSync(envPath, text)
  process.env.GMAIL_REFRESH_TOKEN = token
  return backupPath
}

export function registerGmailAuthRoutes(app) {
  app.post('/api/gmail/oauth/start', (req, res) => {
    try {
      assertAllowedAccessUser(req)
      pruneStates()
      const state = randomBytes(24).toString('hex')
      states.set(state, { expiresAt: Date.now() + STATE_TTL_MS })

      const url = oauthClient(req).generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
        state,
      })

      res.json({ url, redirectUri: redirectUri(req) })
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message })
    }
  })

  app.get('/api/gmail/oauth/callback', async (req, res) => {
    try {
      assertAllowedAccessUser(req)
      const { code, state, error } = req.query
      if (error) throw new Error(`Google denied access: ${error}`)
      if (!code || !state) throw new Error('Missing OAuth code or state')

      pruneStates()
      if (!states.has(state)) throw new Error('OAuth session expired. Start Gmail reconnect again.')
      states.delete(state)

      const { tokens } = await oauthClient(req).getToken(String(code))
      if (!tokens.refresh_token) {
        throw new Error('Google did not return a refresh token. Revoke this app at myaccount.google.com/permissions and reconnect again.')
      }

      persistRefreshToken(tokens.refresh_token)
      res.type('html').send(callbackHtml(true, 'The production Gmail token has been refreshed. You can return to the newsletter and press Sync.'))
    } catch (err) {
      console.error('[gmail-oauth] callback error:', err)
      res.status(err.status || 500).type('html').send(callbackHtml(false, err.message))
    }
  })
}