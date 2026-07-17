import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from './api.js'
import AppSwitcher from './appShell/AppSwitcher.jsx'
import NewsletterList from './components/NewsletterList.jsx'
import PreviewPane from './components/PreviewPane.jsx'
import ReaderPage from './components/ReaderPage.jsx'
import SearchBar from './components/SearchBar.jsx'
import Sidebar from './components/Sidebar.jsx'

const FILTERS = ['all', 'today', 'unread', 'starred', 'archived']
const MOBILE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'unread', label: 'Unread' },
  { key: 'starred', label: 'Starred' },
  { key: 'archived', label: 'Archived' },
]

function localMidnight() {
  return new Date().setHours(0, 0, 0, 0)
}

function useIsLarge() {
  const [isLarge, setIsLarge] = useState(() => typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsLarge(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isLarge
}

function Pagination({ page, pageSize, total, count, hasMore, onPrev, onNext }) {
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-4 text-sm">
      <button onClick={onPrev} disabled={page === 0} className="flex items-center gap-1.5 text-slate-600 transition-colors hover:text-slate-950 disabled:pointer-events-none disabled:opacity-25">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Newer
      </button>
      <span className="text-xs tabular-nums text-slate-500">{total > 0 ? `${page * pageSize + 1}-${page * pageSize + count} of ${total}` : ''}</span>
      <button onClick={onNext} disabled={!hasMore} className="flex items-center gap-1.5 text-slate-600 transition-colors hover:text-slate-950 disabled:pointer-events-none disabled:opacity-25">
        Older
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  )
}

function ConfirmDialog({ open, unreadCount, busy, onCancel, onConfirm }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    previousFocusRef.current = document.activeElement
    window.setTimeout(() => cancelRef.current?.focus(), 0)

    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onCancel()
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [busy, onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="mark-all-read-title" aria-describedby="mark-all-read-description" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 text-slate-950 shadow-xl">
        <h2 id="mark-all-read-title" className="text-base font-semibold">Mark all newsletters read?</h2>
        <p id="mark-all-read-description" className="mt-2 text-sm leading-6 text-slate-600">
          This will mark {unreadCount} unread {unreadCount === 1 ? 'newsletter' : 'newsletters'} as read. Starred and archived states are unchanged.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="min-h-10 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50">{busy ? 'Marking...' : 'Mark all read'}</button>
        </div>
      </div>
    </div>
  )
}

function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isLarge = useIsLarge()
  const searchRef = useRef(null)

  const filterParam = searchParams.get('filter') || 'all'
  const filter = FILTERS.includes(filterParam) ? filterParam : 'all'
  const sender = searchParams.get('sender') || ''
  const q = searchParams.get('q') || ''
  const since = useMemo(() => localMidnight(), [])

  const [newsletters, setNewsletters] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [searchInput, setSearchInput] = useState(q)
  const [senders, setSenders] = useState([])
  const [counts, setCounts] = useState({ today: 0, unread: 0, starred: 0, archived: 0, total: 0 })
  const [expandedSources, setExpandedSources] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [confirmReadOpen, setConfirmReadOpen] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  const updateSearch = useCallback((updates, options = {}) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value == null || value === '' || (key === 'filter' && value === 'all')) next.delete(key)
        else next.set(key, value)
      }
      return next
    }, options)
  }, [setSearchParams])

  const refreshMeta = useCallback(() => {
    fetch(apiUrl(`/api/counts?since=${since}`)).then(r => r.json()).then(setCounts).catch(() => {})
    fetch(apiUrl('/api/senders')).then(r => r.json()).then(setSenders).catch(() => {})
  }, [since])

  const fetchPage = useCallback((targetPage) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(targetPage) })
    if (q) params.set('q', q)
    if (sender) params.set('sender', sender)
    if (filter === 'today') params.set('since', String(since))
    else if (filter !== 'all') params.set('filter', filter)

    fetch(apiUrl(`/api/newsletters?${params}`))
      .then(r => r.json())
      .then(data => {
        setNewsletters(data.newsletters || [])
        setHasMore(!!data.hasMore)
        if (typeof data.total === 'number') setTotal(data.total)
        if (typeof data.pageSize === 'number') setPageSize(data.pageSize)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter, q, sender, since])

  const refreshPageAndMeta = useCallback(() => {
    fetchPage(page)
    refreshMeta()
  }, [fetchPage, page, refreshMeta])

  useEffect(() => { refreshMeta() }, [refreshMeta])

  useEffect(() => {
    if (q !== searchInput) setSearchInput(q)
  }, [q])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim()
      if (next !== q) updateSearch({ q: next }, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [q, searchInput, updateSearch])

  useEffect(() => {
    setPage(0)
    setSelectedId(null)
  }, [filter, sender, q])

  useEffect(() => { fetchPage(page) }, [fetchPage, page])

  useEffect(() => {
    function onKeyDown(e) {
      const target = e.target
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        e.preventDefault()
        setSearchInput('')
        updateSearch({ q: '' }, { replace: true })
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [updateSearch])

  function changeFilter(nextFilter) {
    updateSearch({ filter: nextFilter })
    setDrawerOpen(false)
  }

  function changeSender(nextSender) {
    updateSearch({ sender: nextSender })
    setDrawerOpen(false)
  }

  const listIds = useMemo(() => newsletters.map(n => n.id), [newsletters])

  function selectNewsletter(newsletter) {
    if (isLarge) setSelectedId(newsletter.id)
    else navigate(`/read/${newsletter.id}${location.search}`, { state: { ids: listIds } })
  }

  const markLoadedRead = useCallback((newsletter) => {
    setNewsletters(prev => prev.map(n => n.id === newsletter.id ? { ...n, read_at: newsletter.read_at } : n))
    if (newsletter.newly_read) refreshMeta()
  }, [refreshMeta])

  async function toggleStar(id) {
    if (!id) return null
    const res = await fetch(apiUrl(`/api/newsletters/${id}/star`), { method: 'POST' })
    const data = await res.json().catch(() => null)
    if (data) setNewsletters(prev => prev.map(n => n.id === id ? { ...n, starred: data.starred } : n))
    refreshMeta()
    if (filter === 'starred') fetchPage(page)
    return data
  }

  async function archiveNewsletter(id) {
    if (!id) return null
    const archived = filter !== 'archived'
    const res = await fetch(apiUrl(`/api/newsletters/${id}/archive`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    })
    const data = await res.json().catch(() => null)
    if (selectedId === id) setSelectedId(null)
    refreshPageAndMeta()
    return data
  }

  async function markUnread(id) {
    if (!id) return null
    const res = await fetch(apiUrl(`/api/newsletters/${id}/read`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: false }),
    })
    const data = await res.json().catch(() => null)
    setNewsletters(prev => prev.map(n => n.id === id ? { ...n, read_at: null } : n))
    refreshMeta()
    return data
  }

  function markAllRead() {
    if (!counts.unread) return
    setConfirmReadOpen(true)
  }

  async function confirmMarkAllRead() {
    if (!counts.unread || markingAllRead) return
    setMarkingAllRead(true)
    try {
      await fetch(apiUrl('/api/newsletters/read-all'), { method: 'POST' })
      const now = new Date().toISOString()
      setNewsletters(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }))
      refreshPageAndMeta()
      setConfirmReadOpen(false)
    } finally {
      setMarkingAllRead(false)
    }
  }

  const sidebarProps = {
    counts,
    senders,
    filter,
    sender,
    onFilterChange: changeFilter,
    onSenderChange: changeSender,
    onMarkAllRead: markAllRead,
    onSynced: refreshPageAndMeta,
    expandedSources,
    onToggleSources: () => setExpandedSources(v => !v),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-950">
      <div className="hidden lg:block"><Sidebar {...sidebarProps} showAppSwitcher /></div>
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/60" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
          <div className="relative h-full w-72 shadow-2xl"><Sidebar {...sidebarProps} showAppSwitcher={false} /></div>
        </div>
      )}

      <main className="flex min-w-0 flex-1">
        <section className="flex w-full min-w-0 flex-col border-r border-slate-200 bg-white lg:w-[420px] lg:shrink-0">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <div className="mb-3 flex items-center gap-3 lg:hidden">
              <AppSwitcher placement="mobile-header" />
              <button onClick={() => setDrawerOpen(true)} aria-label="Open local newsletter menu" className="ml-auto rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              {counts.unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">{counts.unread}</span>}
            </div>
            <SearchBar ref={searchRef} query={searchInput} onChange={setSearchInput} className="w-full" />
            <div className="mt-3 flex gap-1 overflow-x-auto lg:hidden">
              {MOBILE_TABS.map(tab => (
                <button key={tab.key} onClick={() => changeFilter(tab.key)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${filter === tab.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? <p className="p-5 text-sm text-slate-500">Loading...</p> : (
              <NewsletterList newsletters={newsletters} selectedId={selectedId} onSelect={selectNewsletter} onToggleStar={toggleStar} onArchive={archiveNewsletter} archivedView={filter === 'archived'} />
            )}
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} count={newsletters.length} hasMore={hasMore} onPrev={() => { setPage(p => Math.max(0, p - 1)); setSelectedId(null) }} onNext={() => { setPage(p => p + 1); setSelectedId(null) }} />
        </section>

        <PreviewPane selectedId={selectedId} listIds={listIds} archivedView={filter === 'archived'} onLoaded={markLoadedRead} onToggleStar={toggleStar} onArchive={archiveNewsletter} onMarkUnread={markUnread} />
      </main>
      <ConfirmDialog open={confirmReadOpen} unreadCount={counts.unread} busy={markingAllRead} onCancel={() => setConfirmReadOpen(false)} onConfirm={confirmMarkAllRead} />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inbox />} />
      <Route path="/read/:id" element={<ReaderPage />} />
    </Routes>
  )
}