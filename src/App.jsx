import { useState, useEffect, useCallback, useRef } from 'react'
import NewsletterList from './components/NewsletterList.jsx'
import NewsletterReader from './components/NewsletterReader.jsx'
import SearchBar from './components/SearchBar.jsx'
import SyncButton from './components/SyncButton.jsx'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'starred', label: 'Starred' },
  { key: 'archived', label: 'Archived' },
]

// Allow deep-linking into a filter via ?filter= (e.g. the homepage's "N unread" badge).
function initialFilter() {
  const f = new URLSearchParams(window.location.search).get('filter')
  return FILTERS.some((x) => x.key === f) ? f : 'all'
}

export default function App() {
  const [newsletters, setNewsletters] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedNewsletter, setSelectedNewsletter] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState(initialFilter)
  const [sender, setSender] = useState('')
  const [senders, setSenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // Debounce the search box into the server `q` param.
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Any query/filter/sender change resets to the first page.
  useEffect(() => { setPage(0) }, [q, filter, sender])

  const fetchPage = useCallback((p, { q, filter, sender }) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (q) params.set('q', q)
    if (filter && filter !== 'all') params.set('filter', filter)
    if (sender) params.set('sender', sender)
    fetch(`/api/newsletters?${params}`)
      .then(r => r.json())
      .then(data => {
        setNewsletters(data.newsletters)
        setHasMore(data.hasMore)
        if (typeof data.total === 'number') setTotal(data.total)
        if (typeof data.unread === 'number') setUnread(data.unread)
        if (typeof data.pageSize === 'number') setPageSize(data.pageSize)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPage(page, { q, filter, sender }) }, [page, q, filter, sender, fetchPage])

  const loadSenders = useCallback(() => {
    fetch('/api/senders').then(r => r.json()).then(setSenders).catch(() => {})
  }, [])
  useEffect(() => { loadSenders() }, [loadSenders])

  useEffect(() => {
    if (selectedId == null) { setSelectedNewsletter(null); return }
    fetch(`/api/newsletters/${selectedId}`)
      .then(r => r.json())
      .then(n => {
        setSelectedNewsletter(n)
        // Opening marks it read server-side — reflect that locally.
        setNewsletters(prev => prev.map(x => x.id === n.id ? { ...x, read_at: n.read_at } : x))
        if (n.newly_read) setUnread(u => Math.max(0, u - 1))
      })
  }, [selectedId])

  function refresh() { fetchPage(page, { q, filter, sender }); loadSenders() }

  async function toggleStar(id) {
    const res = await fetch(`/api/newsletters/${id}/star`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    if (data) setNewsletters(prev => prev.map(n => n.id === id ? { ...n, starred: data.starred } : n))
    if (filter === 'starred') refresh()
  }

  async function markAllRead() {
    await fetch('/api/newsletters/read-all', { method: 'POST' })
    const now = new Date().toISOString()
    setNewsletters(prev => prev.map(n => n.read_at ? n : { ...n, read_at: now }))
    setUnread(0)
    loadSenders()
  }

  async function archive(id, archived = true) {
    await fetch(`/api/newsletters/${id}/archive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }),
    })
    if (selectedId === id) setSelectedId(null)
    refresh()
  }

  const idx = newsletters.findIndex(n => n.id === selectedId)
  const hasPrev = idx > 0
  const hasNext = idx >= 0 && idx < newsletters.length - 1
  function goNext() { if (hasNext) setSelectedId(newsletters[idx + 1].id) }
  function goPrev() { if (hasPrev) setSelectedId(newsletters[idx - 1].id) }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            Newsletters
            {unread > 0 && (
              <span className="ml-2 align-middle text-xs font-medium bg-blue-600 text-white rounded-full px-2 py-0.5">
                {unread}
              </span>
            )}
          </h1>
          <SearchBar query={searchInput} onChange={setSearchInput} />
          <div className="ml-auto">
            <SyncButton onSynced={(r) => { if (r.added > 0) refresh() }} />
          </div>
        </div>
        <div className="max-w-3xl mx-auto flex items-center gap-2 px-4 pb-2.5">
          <div className="flex gap-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setSelectedId(null) }}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  filter === f.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs px-2.5 py-1 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors whitespace-nowrap"
                title="Mark all newsletters as read"
              >
                ✓ Mark all read
              </button>
            )}
            <select
              value={sender}
              onChange={e => { setSender(e.target.value); setSelectedId(null) }}
              className="text-xs bg-gray-800 border border-gray-700 rounded-md text-gray-300 px-2 py-1 max-w-[12rem] focus:outline-none focus:border-blue-500"
            >
              <option value="">All senders</option>
              {senders.map(s => (
                <option key={s.from_email} value={s.from_email}>
                  {(s.from_name || s.from_email)}{s.unread > 0 ? ` (${s.unread})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <p className="p-4 text-gray-500 text-sm">Loading…</p>
          ) : (
            <NewsletterList
              newsletters={newsletters}
              onSelect={id => setSelectedId(id)}
              onToggleStar={toggleStar}
              onArchive={(id) => archive(id, filter !== 'archived')}
              archivedView={filter === 'archived'}
            />
          )}

          {!loading && newsletters.length > 0 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-gray-800 text-sm">
              <button
                onClick={() => { setPage(p => p - 1); setSelectedId(null) }}
                disabled={page === 0}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-100 disabled:opacity-25 disabled:pointer-events-none transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Newer
              </button>

              <span className="text-gray-500 text-xs">
                {total > 0 ? `${page * pageSize + 1}–${page * pageSize + newsletters.length} of ${total}` : ''}
              </span>

              <button
                onClick={() => { setPage(p => p + 1); setSelectedId(null) }}
                disabled={!hasMore}
                className="flex items-center gap-1.5 text-gray-400 hover:text-gray-100 disabled:opacity-25 disabled:pointer-events-none transition-colors"
              >
                Older
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </main>

      {selectedId != null && (
        <NewsletterReader
          newsletter={selectedNewsletter}
          onClose={() => setSelectedId(null)}
          onPrev={hasPrev ? goPrev : null}
          onNext={hasNext ? goNext : null}
          onToggleStar={() => toggleStar(selectedId)}
          onArchive={() => archive(selectedId, filter !== 'archived')}
          archivedView={filter === 'archived'}
        />
      )}
    </div>
  )
}
