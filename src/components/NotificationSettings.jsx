import { useEffect, useState } from 'react'
import { apiFetch, apiUrl } from '../api.js'
import { prepareNotifications, saveSubscription } from '../notifications.js'

export default function NotificationSettings() {
  const [ready, setReady] = useState(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const supported = 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator && window.isSecureContext
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const needsInstall = ios && !(navigator.standalone || window.matchMedia('(display-mode: standalone)').matches)

  useEffect(() => {
    if (!supported || needsInstall) { setBusy(false); return }
    let cancelled = false
    async function load() {
      try {
        const [reg, response] = await Promise.all([prepareNotifications(), fetch(apiUrl('/api/push/config'))])
        if (!reg || !response.ok) throw new Error('Could not load notifications. Sign in and try again.')
        const { publicKey } = await response.json()
        const key = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4)), char => char.charCodeAt(0))
        if (!cancelled) setReady({ reg, key })
        const subscription = await reg.pushManager.getSubscription()
        if (subscription && Notification.permission === 'granted') {
          const oldKey = new Uint8Array(subscription.options.applicationServerKey || [])
          if (oldKey.length !== key.length || oldKey.some((value, i) => value !== key[i])) {
            await subscription.unsubscribe()
          } else {
            await saveSubscription(subscription)
            if (!cancelled) setEnabled(true)
          }
        }
      } catch (error) { if (!cancelled) setMessage(error.message) }
      finally { if (!cancelled) setBusy(false) }
    }
    load()
    return () => { cancelled = true }
  }, [supported, needsInstall])

  async function toggle() {
    setMessage('')
    setBusy(true)
    try {
      if (enabled) {
        const subscription = await ready.reg.pushManager.getSubscription()
        if (subscription) {
          const endpoint = subscription.endpoint
          const removed = await subscription.unsubscribe()
          if (!removed) throw new Error('Could not disable notifications. Please try again.')
          setEnabled(false)
          // Unsubscribe in the browser first, so delivery stops even offline.
          const res = await apiFetch('/api/push/subscription', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }),
          })
          if (!res.ok) throw new Error('Notifications are off on this device. Server cleanup will finish on the next delivery.')
        }
        setEnabled(false)
      } else {
        // Called directly from a tap; never request permission during page load.
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('Allow notifications in your device’s Settings, then try again.')
        const subscription = await ready.reg.pushManager.getSubscription() || await ready.reg.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: ready.key,
        })
        await saveSubscription(subscription)
        setEnabled(true)
      }
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-2 px-4 py-3 text-xs text-slate-400">
      <button type="button" onClick={toggle} disabled={busy || !ready || needsInstall || !supported}
        className="min-h-10 w-full rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50">
        {busy ? 'Checking notifications…' : enabled ? 'Disable notifications' : 'Enable notifications & badge'}
      </button>
      <p>{needsInstall ? 'In Safari, use Share → Add to Home Screen, then open Newsletter from its icon.'
        : !supported ? 'Home Screen notifications need iPadOS 16.4 or later, or a browser that supports Web Push.'
          : enabled ? 'On for this device. Your unread badge updates after sync and inbox changes.'
            : 'Get unread badge updates and notifications while the app is closed.'}</p>
      {message && <p role="status" className="text-amber-300">{message}</p>}
    </div>
  )
}
