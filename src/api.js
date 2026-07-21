// Prefix an absolute path with the app's base path (import.meta.env.BASE_URL:
// '/' in dev, '/newsletter/' after the Phase 4 migration).
let readOnly = false
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function apiUrl(path) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}

export function setApiReadOnly(value) {
  readOnly = Boolean(value)
}

export function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  if (readOnly && !SAFE_METHODS.has(method)) {
    throw new Error('This account is read-only.')
  }
  return fetch(apiUrl(path), options)
}
