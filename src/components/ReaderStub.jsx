import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { apiUrl } from '../api.js'

export default function ReaderStub() {
  const { id } = useParams()
  const location = useLocation()
  const [newsletter, setNewsletter] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setNewsletter(null)
    setError('')
    fetch(apiUrl(`/api/newsletters/${id}`))
      .then(r => {
        if (!r.ok) throw new Error('Could not load newsletter')
        return r.json()
      })
      .then(data => { if (!cancelled) setNewsletter(data) })
      .catch(err => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="min-h-screen bg-gray-950 p-3 text-gray-100 sm:p-5">
      <div className="mx-auto flex h-[calc(100vh-1.5rem)] max-w-5xl flex-col overflow-hidden rounded-md bg-white text-gray-950 shadow-2xl sm:h-[calc(100vh-2.5rem)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Link to={`/${location.search}`} className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-950">
            Back
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{newsletter?.subject || 'Newsletter'}</h1>
            {newsletter && <p className="truncate text-xs text-gray-500">{newsletter.from_name || newsletter.from_email}</p>}
          </div>
        </header>
        {error && <div className="flex flex-1 items-center justify-center text-sm text-red-600">{error}</div>}
        {!error && !newsletter && <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Loading...</div>}
        {newsletter?.reader_html && (
          <iframe
            key={newsletter.id}
            srcDoc={newsletter.reader_html}
            sandbox="allow-same-origin allow-popups"
            referrerPolicy="no-referrer"
            className="h-full w-full flex-1 border-0"
            title={newsletter.subject}
          />
        )}
      </div>
    </div>
  )
}