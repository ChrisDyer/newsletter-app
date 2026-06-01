import { google } from 'googleapis'

export function getGmailClient() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_GMAIL_CLIENT_ID,
    process.env.GOOGLE_GMAIL_CLIENT_SECRET,
  )
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

async function resolveLabelId(gmail, labelName) {
  const res = await gmail.users.labels.list({ userId: 'me' })
  const label = (res.data.labels || []).find(
    l => l.name.toLowerCase() === labelName.toLowerCase()
  )
  if (!label) throw new Error(`Gmail label "${labelName}" not found`)
  return label.id
}

export async function listMessageIds(gmail, labelName) {
  const labelId = await resolveLabelId(gmail, labelName)
  const ids = []
  let pageToken

  do {
    const res = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
      maxResults: 500,
      pageToken,
    })
    for (const m of res.data.messages || []) ids.push(m.id)
    pageToken = res.data.nextPageToken
  } while (pageToken)

  return ids
}

function decodeBase64Url(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

function extractParts(part, html, text) {
  if (part.mimeType === 'text/html' && part.body?.data) {
    html.push(decodeBase64Url(part.body.data))
  } else if (part.mimeType === 'text/plain' && part.body?.data) {
    text.push(decodeBase64Url(part.body.data))
  }
  for (const sub of part.parts || []) {
    extractParts(sub, html, text)
  }
}

function parseFrom(header) {
  if (!header) return { name: null, email: null }
  const m = header.match(/^(.*?)\s*<([^>]+)>$/)
  if (m) return { name: m[1].replace(/^["']|["']$/g, '').trim(), email: m[2].trim() }
  return { name: null, email: header.trim() }
}

export async function fetchMessage(gmail, id) {
  const res = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full',
  })
  const msg = res.data
  const headers = {}
  for (const h of msg.payload?.headers || []) {
    headers[h.name.toLowerCase()] = h.value
  }

  const htmlParts = []
  const textParts = []
  extractParts(msg.payload || {}, htmlParts, textParts)

  const { name: fromName, email: fromEmail } = parseFrom(headers['from'])

  return {
    gmail_id: msg.id,
    thread_id: msg.threadId,
    from_name: fromName,
    from_email: fromEmail,
    subject: headers['subject'] || '(no subject)',
    date: headers['date'] || null,
    // Gmail's internalDate is epoch-ms (as a string) and is always present, unlike the
    // freeform Date: header which can be missing or unparseable. Store it for sorting.
    internal_date: msg.internalDate ? Number(msg.internalDate) : null,
    snippet: msg.snippet || null,
    body_html: htmlParts[0] || null,
    body_text: textParts[0] || null,
  }
}
