import { apiFetch, apiUrl } from './api.js'

let registration
export function prepareNotifications() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return Promise.resolve(null)
  if (!registration) registration = navigator.serviceWorker.register(apiUrl('/sw.js'), { scope: import.meta.env.BASE_URL })
    .then(() => navigator.serviceWorker.ready)
    .catch(error => { registration = null; throw error })
  return registration
}

export async function refreshAppBadge() {
  const res = await fetch(apiUrl('/api/counts'))
  if (!res.ok) throw new Error('Could not refresh unread count')
  const state = await res.json()
  const reg = await prepareNotifications()
  reg?.active?.postMessage({ type: 'NEWSLETTER_BADGE', unread: state.unread, revision: state.revision })
}

export async function saveSubscription(subscription) {
  const res = await apiFetch('/api/push/subscription', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Could not enable notifications. Sign in and try again.')
  }
  const state = await res.json()
  const reg = await prepareNotifications()
  reg?.active?.postMessage({ type: 'NEWSLETTER_BADGE', unread: state.unread, revision: state.revision })
}

export function refreshUnreadBadge() {
  window.dispatchEvent(new Event('newsletter-unread-changed'))
}
