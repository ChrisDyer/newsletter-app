import { useState } from 'react'
import { apiFetch } from '../api.js'

export default function SyncButton({ onSynced }) {
  const [syncing, setSyncing] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)
  const [canReconnect, setCanReconnect] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setError(null)
    setCanReconnect(false)
    try {
      const res = await apiFetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setCanReconnect(Boolean(data.reconnect))
        throw new Error(data.action || data.error || 'Sync failed')
      }
      setLastResult(data)
      onSynced?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleReconnect() {
    setReconnecting(true)
    setError(null)
    try {
      const res = await apiFetch('/api/gmail/oauth/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start Gmail reconnect')
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setReconnecting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={syncing || reconnecting}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582M20 20v-5h-.581M5.636 15A9 9 0 1 0 5 9.5" />
        </svg>
        {syncing ? 'Syncing...' : 'Sync'}
      </button>
      {canReconnect && (
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          className="w-full px-3 py-2 text-sm font-medium rounded-md bg-amber-500 text-gray-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {reconnecting ? 'Opening Google...' : 'Reconnect Gmail'}
        </button>
      )}
      {lastResult && !error && (
        <p className="text-xs text-gray-500 text-center">
          {lastResult.added > 0 ? `+${lastResult.added} new` : 'Up to date'}
        </p>
      )}
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  )
}