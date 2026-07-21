import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '../api.js'
import SenderAvatar from './SenderAvatar.jsx'

function ActionButton({ label, children, onClick, active = false }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-950'}`}
    >
      {children}
    </button>
  )
}

export default function PreviewPane({ selectedId, listIds = [], archivedView, onLoaded, onToggleStar, onArchive, onMarkUnread, readOnly = false }) {
  const [newsletter, setNewsletter] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!selectedId) {
      setNewsletter(null)
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    fetch(apiUrl(`/api/newsletters/${selectedId}${readOnly ? '?mark_read=0' : ''}`))
      .then(r => {
        if (!r.ok) throw new Error('Could not load newsletter')
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        setNewsletter(data)
        onLoaded?.(data)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [readOnly, selectedId, onLoaded])

  if (!selectedId) {
    return (
      <section className="hidden min-w-0 flex-1 bg-slate-50 p-4 lg:block">
        <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
          Select a newsletter to read
        </div>
      </section>
    )
  }

  const body = newsletter?.reader_html

  return (
    <section className="hidden min-w-0 flex-1 bg-slate-50 p-4 lg:block">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-sm">
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4">
          {newsletter ? <SenderAvatar name={newsletter.from_name} email={newsletter.from_email} size="lg" /> : <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200" />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-950">{newsletter?.subject || 'Loading...'}</h2>
            <p className="mt-1 truncate text-sm text-slate-600">
              {newsletter ? `${newsletter.from_name || 'Unknown'} <${newsletter.from_email || 'unknown'}>` : ''}
            </p>
            {newsletter && (
              <p className="mt-1 text-xs text-slate-500">
                {new Date(Number(newsletter.internal_date) || newsletter.date).toLocaleString()} {newsletter.reading_minutes ? `- ${newsletter.reading_minutes} min read` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!readOnly && (
              <>
                <ActionButton label={newsletter?.starred ? 'Unstar' : 'Star'} active={!!newsletter?.starred} onClick={async () => { const data = await onToggleStar(newsletter?.id); if (data) setNewsletter(n => n ? { ...n, starred: data.starred } : n) }}>
                  <svg className="h-4 w-4" fill={newsletter?.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5l2 4.06 4.48.65-3.24 3.16.77 4.46-4-2.1-4 2.1.76-4.46L4 8.2l4.48-.65 2-4.06z" /></svg>
                </ActionButton>
                <ActionButton label={archivedView ? 'Restore' : 'Archive'} onClick={() => onArchive(newsletter?.id)}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l-1 12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1L19 8M5 8l1-3h12l1 3M10 12h4" /></svg>
                </ActionButton>
                <ActionButton label="Mark unread" onClick={async () => { await onMarkUnread(newsletter?.id); setNewsletter(n => n ? { ...n, read_at: null } : n) }}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l8.2 5.5a1.5 1.5 0 0 0 1.6 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" /></svg>
                </ActionButton>
              </>
            )}
            <ActionButton label="Expand" onClick={() => navigate(`/read/${selectedId}${location.search}`, { state: { ids: listIds } })}>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" /></svg>
            </ActionButton>
          </div>
        </header>

        {loading && <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading...</div>}
        {error && <div className="flex flex-1 items-center justify-center text-sm text-red-700">{error}</div>}
        {!loading && !error && body && (
          <iframe
            key={newsletter.id}
            srcDoc={body}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-full w-full flex-1 border-0"
            title={newsletter?.subject}
          />
        )}
      </div>
    </section>
  )
}