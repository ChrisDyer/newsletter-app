// Push only: never cache private pages, API responses, or Cloudflare login pages.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

function withBadgeStore(update) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('newsletter-badge', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('state')
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Badge storage is blocked'))
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('state', 'readwrite')
      const store = tx.objectStore('state')
      const read = store.get('latest')
      let latest
      read.onsuccess = () => {
        const previous = read.result
        latest = previous && previous.revision > update.revision ? previous : update
        store.put(latest, 'latest')
      }
      tx.oncomplete = () => { db.close(); resolve(latest) }
      tx.onerror = () => { db.close(); reject(tx.error) }
      tx.onabort = () => { db.close(); reject(tx.error) }
    }
  })
}

let queue = Promise.resolve()
function updateBadge(data, notify = false) {
  queue = queue.catch(() => {}).then(async () => {
    const valid = Number.isSafeInteger(data?.unread) && data.unread >= 0 && Number.isSafeInteger(data?.revision) && data.revision >= 0
    const latest = valid ? await withBadgeStore({ unread: data.unread, revision: data.revision }).catch(() => data) : null
    const tasks = []
    if (latest && 'setAppBadge' in navigator) tasks.push(navigator.setAppBadge(latest.unread).catch(() => {}))
    // Always display a notification for push, even if the badge API fails or the
    // payload is stale. Apple forbids using pushes solely for badge updates.
    if (notify) {
      const body = latest
        ? (latest.unread ? `${latest.unread} unread ${latest.unread === 1 ? 'newsletter' : 'newsletters'}` : 'You’re all caught up.')
        : 'Your newsletter inbox has been updated.'
      tasks.push(self.registration.showNotification('Newsletters', {
        body, icon: '/icons/icon-192.png', tag: 'newsletter-unread',
        data: { url: '/?filter=unread' },
      }))
    }
    await Promise.all(tasks)
    if (notify) {
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach(client => client.postMessage({ type: 'NEWSLETTER_PUSH' }))
    }
  })
  return queue
}

self.addEventListener('push', event => {
  let data
  try { data = event.data?.json() } catch { /* Still show a notification. */ }
  event.waitUntil(updateBadge(data, true))
})
self.addEventListener('message', event => {
  if (event.data?.type === 'NEWSLETTER_BADGE') event.waitUntil(updateBadge(event.data))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const url = new URL('/?filter=unread', self.location.origin).href
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = clients.find(item => new URL(item.url).origin === self.location.origin)
    if (client) {
      await client.navigate(url)
      await client.focus()
    } else await self.clients.openWindow(url)
  })())
})
