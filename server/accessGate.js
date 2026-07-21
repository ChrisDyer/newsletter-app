const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email) {
  const admins = adminEmails()
  return admins.length === 0 || admins.includes((email || '').toLowerCase())
}

export function accessGate(req, res, next) {
  const token = process.env.INTERNAL_API_TOKEN
  if (token && req.headers['x-internal-token'] === token) return next()

  const email = (req.headers['cf-access-authenticated-user-email'] || '').toLowerCase()
  if (!email && process.env.ALLOW_NO_ACCESS_HEADER !== '1') {
    return res.status(403).send('Forbidden')
  }

  req.userEmail = email || null
  req.readOnly = Boolean(email) && !isAdminEmail(email)
  if (req.readOnly && !SAFE_METHODS.has(req.method)) {
    return res.status(403).json({ error: 'read_only', message: 'This account is read-only.' })
  }

  return next()
}
