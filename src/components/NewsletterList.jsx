import SenderAvatar from './SenderAvatar.jsx'

export function groupByDate(newsletters) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups = []
  const keyToIndex = new Map()

  for (const n of newsletters) {
    const internalDate = Number(n.internal_date)
    let d = Number.isFinite(internalDate) ? new Date(internalDate) : new Date(n.date)
    if (Number.isNaN(d.getTime())) d = new Date(0)
    d.setHours(0, 0, 0, 0)
    const key = d.getTime()

    let label
    if (key === today.getTime()) label = 'TODAY'
    else if (key === yesterday.getTime()) label = 'YESTERDAY'
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, groups.length)
      groups.push({ label, items: [] })
    }
    groups[keyToIndex.get(key)].items.push(n)
  }

  return groups
}

export function formatRelativeTime(value) {
  const date = value ? new Date(Number(value) || value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minute = 60000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}m`
  if (diff < day) return `${Math.floor(diff / hour)}h`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StarButton({ starred, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={starred ? 'Unstar' : 'Star'}
      title={starred ? 'Unstar' : 'Star'}
      className={`rounded p-1 transition-colors ${starred ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300'}`}
    >
      <svg className="h-4 w-4" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5l2 4.06 4.48.65-3.24 3.16.77 4.46-4-2.1-4 2.1.76-4.46L4 8.2l4.48-.65 2-4.06z" />
      </svg>
    </button>
  )
}

export default function NewsletterList({ newsletters, selectedId, onSelect, onToggleStar, onArchive, archivedView }) {
  if (newsletters.length === 0) {
    return <p className="p-5 text-sm text-gray-500">No newsletters found.</p>
  }

  const groups = groupByDate(newsletters)
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return (
    <div>
      {groups.map(group => (
        <section key={group.label}>
          <div className="sticky top-0 z-10 border-y border-gray-800 bg-gray-950/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 backdrop-blur">
            {group.label}
          </div>
          <ul>
            {group.items.map(n => {
              const unread = !n.read_at
              const selected = selectedId === n.id
              return (
                <li key={n.id}>
                  <button
                    onClick={() => onSelect(n)}
                    className={`group grid w-full grid-cols-[auto_1fr_auto] gap-3 border-b border-gray-800/70 px-4 py-3 text-left transition-colors ${
                      selected ? 'bg-blue-950/45 ring-1 ring-inset ring-blue-800/60' : 'hover:bg-gray-900'
                    }`}
                  >
                    <div className="relative pt-0.5">
                      <SenderAvatar name={n.from_name} email={n.from_email} />
                      {unread && <span className="absolute -left-2 top-4 h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`truncate text-sm ${unread ? 'font-bold text-white' : 'font-semibold text-gray-300'}`}>
                          {n.from_name || n.from_email || 'Unknown'}
                        </span>
                        <span className="shrink-0 text-xs text-gray-600">{formatRelativeTime(n.internal_date || n.date)}</span>
                      </div>
                      <p className={`mt-0.5 truncate text-sm ${unread ? 'font-semibold text-gray-100' : 'text-gray-300'}`}>{n.subject || 'Untitled'}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{n.snippet || ''}</p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
                        {n.reading_minutes ? <span>{n.reading_minutes} min read</span> : null}
                        {n.from_email ? <span className="truncate">{n.from_email}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 pt-0.5" onClick={e => e.stopPropagation()}>
                      <StarButton starred={!!n.starred} onClick={stop(() => onToggleStar(n.id))} />
                      <button
                        onClick={stop(() => onArchive(n.id))}
                        aria-label={archivedView ? 'Restore' : 'Archive'}
                        title={archivedView ? 'Restore' : 'Archive'}
                        className="rounded p-1 text-gray-600 opacity-100 transition-colors hover:text-gray-300 lg:opacity-0 lg:group-hover:opacity-100"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {archivedView
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 10l2-5h14l2 5M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 14l2-2m0 0 2 2m-2-2v6" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l-1 12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1L19 8M5 8l1-3h12l1 3M10 12h4" />}
                        </svg>
                      </button>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}