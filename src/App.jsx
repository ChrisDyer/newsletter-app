import { useState, useEffect, useCallback } from 'react'
import NewsletterList from './components/NewsletterList.jsx'
import NewsletterReader from './components/NewsletterReader.jsx'
import SearchBar from './components/SearchBar.jsx'
import SyncButton from './components/SyncButton.jsx'

export default function App() {
  const [newsletters, setNewsletters] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedNewsletter, setSelectedNewsletter] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const fetchPage = useCallback((p) => {
    setLoading(true)
    fetch(`/api/newsletters?page=${p}`)
      .then(r => r.json())
      .then(data => {
        setNewsletters(data.newsletters)
        setHasMore(data.hasMore)
        if (typeof data.total === 'number') setTotal(data.total)
        if (typeof data.pageSize === 'number') setPageSize(data.pageSize)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { fetchPage(page) }, [page, fetchPage])

  useEffect(() => {
    if (selectedId == null) { setSelectedNewsletter(null); return }
    fetch(`/api/newsletters/${selectedId}`)
      .then(r => r.json())
      .then(setSelectedNewsletter)
  }, [selectedId])

  const filtered = newsletters.filter(n => {
    const q = query.toLowerCase()
    return (
      (n.from_name || '').toLowerCase().includes(q) ||
      (n.from_email || '').toLowerCase().includes(q) ||
      (n.subject || '').toLowerCase().includes(q)
    )
  })

  function handleSynced(result) {
    if (result.added > 0) fetchPage(0)
  }

  const idx = filtered.findIndex(n => n.id === selectedId)
  const hasPrev = idx > 0
  const hasNext = idx < filtered.length - 1
  function goNext() { if (hasNext) setSelectedId(filtered[idx + 1].id) }
  function goPrev() { if (hasPrev) setSelectedId(filtered[idx - 1].id) }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-4 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">Newsletters</h1>
          <SearchBar query={query} onChange={setQuery} />
          <div className="ml-auto">
            <SyncButton onSynced={handleSynced} />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <p className="p-4 text-gray-500 text-sm">Loading…</p>
          ) : (
            <NewsletterList
              newsletters={filtered}
              onSelect={id => { setSelectedId(id); setQuery('') }}
            />
          )}

          {/* Pagination */}
          {!loading && (
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
                {total > 0
                  ? `${page * pageSize + 1}–${page * pageSize + newsletters.length} of ${total}`
                  : 'No newsletters'}
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
        />
      )}
    </div>
  )
}
