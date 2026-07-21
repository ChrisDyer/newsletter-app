import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { apiFetch, apiUrl } from '../api.js'
import AppSwitcher from '../appShell/AppSwitcher.jsx'
import { useReadOnly } from '../readOnly.jsx'
import SenderAvatar from './SenderAvatar.jsx'

function IconButton({ label, children, onClick, disabled = false, active = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors disabled:pointer-events-none disabled:opacity-30 ${
        active
          ? 'border-amber-200 bg-amber-100 text-amber-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      }`}
    >
      {children}
    </button>
  )
}

function TextButton({ children, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function displayDate(newsletter) {
  const value = newsletter?.internal_date || newsletter?.date
  const date = value ? new Date(Number(value) || value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ReaderPage() {
  const { readOnly } = useReadOnly()
  const { id } = useParams()
  const numericId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const touchStartX = useRef(null)
  const cacheRef = useRef(new Map())
  const [newsletter, setNewsletter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const ids = useMemo(() => {
    const stateIds = location.state?.ids
    return Array.isArray(stateIds) ? stateIds.map(Number).filter(Number.isFinite) : []
  }, [location.state])
  const currentIndex = ids.indexOf(numericId)
  const previousId = currentIndex > 0 ? ids[currentIndex - 1] : null
  const nextId = currentIndex >= 0 && currentIndex < ids.length - 1 ? ids[currentIndex + 1] : null
  const hasStateNavigation = currentIndex >= 0

  const goBack = useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate({ pathname: '/', search: location.search }, { replace: true })
  }, [location.search, navigate])

  const goTo = useCallback((targetId) => {
    if (!targetId) return
    navigate(`/read/${targetId}${location.search}`, { replace: true, state: { ids } })
  }, [ids, location.search, navigate])

  const markDisplayedRead = useCallback(async (targetId) => {
    if (readOnly) return
    const res = await apiFetch(`/api/newsletters/${targetId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    })
    if (!res.ok) throw new Error('Could not mark newsletter read')
  }, [readOnly])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    async function loadNewsletter() {
      try {
        const cached = cacheRef.current.get(numericId)
        if (cached) {
          await markDisplayedRead(numericId)
          if (!cancelled) {
            const readAt = cached.read_at || new Date().toISOString()
            const data = { ...cached, read_at: readAt, newly_read: !cached.read_at }
            cacheRef.current.set(numericId, data)
            setNewsletter(data)
          }
          return
        }

        const res = await fetch(apiUrl(`/api/newsletters/${numericId}${readOnly ? '?mark_read=0' : ''}`))
        if (!res.ok) throw new Error('Could not load newsletter')
        const data = await res.json()
        cacheRef.current.set(numericId, data)
        if (!cancelled) setNewsletter(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (Number.isFinite(numericId)) loadNewsletter()
    else {
      setError('Invalid newsletter id')
      setLoading(false)
    }

    return () => { cancelled = true }
  }, [markDisplayedRead, numericId, readOnly])

  useEffect(() => {
    let cancelled = false
    const neighbors = [previousId, nextId].filter(Boolean)
    for (const neighborId of neighbors) {
      if (cacheRef.current.has(neighborId)) continue
      fetch(apiUrl(`/api/newsletters/${neighborId}?mark_read=0`))
        .then(r => {
          if (!r.ok) throw new Error('Could not prefetch newsletter')
          return r.json()
        })
        .then(data => {
          if (!cancelled) cacheRef.current.set(neighborId, data)
        })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [nextId, previousId])

  useEffect(() => {
    function onKey(e) {
      const target = e.target
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable
      if (typing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        goBack()
      }
      if (e.key === 'ArrowLeft' && previousId) {
        e.preventDefault()
        goTo(previousId)
      }
      if (e.key === 'ArrowRight' && nextId) {
        e.preventDefault()
        goTo(nextId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack, goTo, nextId, previousId])

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    touchStartX.current = null
    if (Math.abs(delta) < 60) return
    if (delta > 0 && nextId) goTo(nextId)
    if (delta < 0 && previousId) goTo(previousId)
  }

  async function toggleStar() {
    if (!newsletter) return
    const res = await apiFetch(`/api/newsletters/${newsletter.id}/star`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    if (data) setNewsletter(n => n ? { ...n, starred: data.starred } : n)
  }

  async function toggleArchive() {
    if (!newsletter) return
    const archived = !newsletter.archived_at
    const res = await apiFetch(`/api/newsletters/${newsletter.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    })
    const data = await res.json().catch(() => null)
    if (data) setNewsletter(n => n ? { ...n, archived_at: archived ? new Date().toISOString() : null } : n)
  }

  async function markUnread() {
    if (!newsletter) return
    await apiFetch(`/api/newsletters/${newsletter.id}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: false }),
    })
    goBack()
  }

  function openOriginal() {
    if (!newsletter?.gmail_id) return
    window.open(`https://mail.google.com/mail/u/0/#all/${newsletter.gmail_id}`, '_blank', 'noopener,noreferrer')
  }

  const dateLabel = displayDate(newsletter)

  return (
    <main
      className="min-h-screen bg-white text-slate-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex min-h-screen w-full flex-col">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          <header className="shrink-0 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <AppSwitcher placement="reader-toolbar" />
                <TextButton onClick={goBack}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back to newsletters
              </TextButton>
              </div>
              <div className="flex items-center gap-2">
                {hasStateNavigation && (
                  <>
                    <IconButton label="Previous newsletter" disabled={!previousId} onClick={() => goTo(previousId)}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </IconButton>
                    <IconButton label="Next newsletter" disabled={!nextId} onClick={() => goTo(nextId)}>
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </IconButton>
                  </>
                )}
                {!readOnly && (
                  <>
                    <IconButton label={newsletter?.archived_at ? 'Restore' : 'Archive'} disabled={!newsletter} onClick={toggleArchive}>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {newsletter?.archived_at
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 10l2-5h14l2 5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 14l2-2m0 0 2 2m-2-2v6" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l-1 12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1L19 8M5 8l1-3h12l1 3M10 12h4" />}
                      </svg>
                    </IconButton>
                    <IconButton label={newsletter?.starred ? 'Unstar' : 'Star'} active={!!newsletter?.starred} disabled={!newsletter} onClick={toggleStar}>
                      <svg className="h-4 w-4" fill={newsletter?.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5l2 4.06 4.48.65-3.24 3.16.77 4.46-4-2.1-4 2.1.76-4.46L4 8.2l4.48-.65 2-4.06z" /></svg>
                    </IconButton>
                    <IconButton label="Mark unread" disabled={!newsletter} onClick={markUnread}>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l8.2 5.5a1.5 1.5 0 0 0 1.6 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" /></svg>
                    </IconButton>
                  </>
                )}
                <IconButton label="Original" disabled={!newsletter?.gmail_id} onClick={openOriginal}>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M9 7h8v8" /></svg>
                </IconButton>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3">
              {newsletter ? <SenderAvatar name={newsletter.from_name} email={newsletter.from_email} size="lg" /> : <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200" />}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold leading-tight text-slate-950 sm:text-2xl">{newsletter?.subject || 'Newsletter'}</h1>
                {newsletter && (
                  <p className="mt-1 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">{newsletter.from_name || 'Unknown'}</span>
                    {newsletter.from_email ? ` <${newsletter.from_email}>` : ''}
                    {dateLabel ? ` - ${dateLabel}` : ''}
                    {newsletter.reading_minutes ? ` - ${newsletter.reading_minutes} min read` : ''}
                  </p>
                )}
              </div>
            </div>
          </header>

          {loading && <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading...</div>}
          {error && <div className="flex flex-1 items-center justify-center text-sm text-red-700">{error}</div>}
          {!loading && !error && newsletter?.reader_html && (
            <iframe
              key={newsletter.id}
              srcDoc={newsletter.reader_html}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className="min-h-0 w-full flex-1 border-0"
              title={newsletter.subject}
            />
          )}
        </section>
      </div>
    </main>
  )
}