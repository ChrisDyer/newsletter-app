import { useState } from 'react'
import { apiUrl } from '../api.js'

export default function SyncButton({ onSynced }) {
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/sync'), { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setLastResult(data)
      onSynced?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={syncing}
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
      {lastResult && !error && (
        <p className="text-xs text-gray-500 text-center">
          {lastResult.added > 0 ? `+${lastResult.added} new` : 'Up to date'}
        </p>
      )}
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  )
}