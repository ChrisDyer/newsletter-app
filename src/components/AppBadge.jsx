import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { refreshAppBadge } from '../notifications.js'

export default function AppBadge() {
  const location = useLocation()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') refreshAppBadge().catch(() => {})
    }
    const onPush = event => { if (event.data?.type === 'NEWSLETTER_PUSH') refresh() }
    refresh()
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('newsletter-unread-changed', refresh)
    navigator.serviceWorker?.addEventListener('message', onPush)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('newsletter-unread-changed', refresh)
      navigator.serviceWorker?.removeEventListener('message', onPush)
    }
  }, [location.pathname])
  return null
}
