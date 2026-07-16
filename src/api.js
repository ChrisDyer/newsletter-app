// Prefix an absolute path with the app's base path (import.meta.env.BASE_URL:
// '/' in dev, '/newsletter/' after the Phase 4 migration).
export function apiUrl(path) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}