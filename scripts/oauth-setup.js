#!/usr/bin/env node
// Run once to get a Gmail refresh_token. Put the result in .env.
import 'dotenv/config'
import { google } from 'googleapis'
import http from 'http'

const PORT = 3333
const REDIRECT_URI = `http://localhost:${PORT}`

const { GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET } = process.env
if (!GOOGLE_GMAIL_CLIENT_ID || !GOOGLE_GMAIL_CLIENT_SECRET) {
  console.error('Set GOOGLE_GMAIL_CLIENT_ID and GOOGLE_GMAIL_CLIENT_SECRET in .env first.')
  process.exit(1)
}

const oauth2 = new google.auth.OAuth2(
  GOOGLE_GMAIL_CLIENT_ID,
  GOOGLE_GMAIL_CLIENT_SECRET,
  REDIRECT_URI,
)

const url = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent',
})

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('code')
  if (!code) {
    res.end('No code received.')
    server.close()
    return
  }

  res.end('<html><body><p>Authorization complete — you can close this tab.</p></body></html>')
  server.close()

  try {
    const { tokens } = await oauth2.getToken(code)
    if (!tokens.refresh_token) {
      console.error('\nNo refresh_token returned.')
      console.error('Revoke access at https://myaccount.google.com/permissions and re-run.\n')
      process.exit(1)
    }
    console.log('\nAdd this to your .env file:\n')
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`)
    console.log()
  } catch (err) {
    console.error('Failed to exchange code:', err.message)
    process.exit(1)
  }
})

server.listen(PORT, () => {
  console.log('\nSTEP 1 — Add this redirect URI in Google Cloud Console:')
  console.log(`  ${REDIRECT_URI}`)
  console.log('  (APIs & Services → Credentials → your OAuth client → Authorized redirect URIs)')
  console.log('\nSTEP 2 — Open this URL in your browser:\n')
  console.log(url)
  console.log()
})
