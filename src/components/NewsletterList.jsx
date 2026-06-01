function SenderAvatar({ name, email }) {
  const char = (name || email || '?')[0].toUpperCase()
  const colors = ['bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600']
  const idx = (name || email || '').charCodeAt(0) % colors.length
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0 ${colors[idx]}`}>
      {char}
    </div>
  )
}

function groupByDate(newsletters) {
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
    if (key === today.getTime()) label = 'Today'
    else if (key === yesterday.getTime()) label = 'Yesterday'
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, groups.length)
      groups.push({ label, items: [] })
    }
    groups[keyToIndex.get(key)].items.push(n)
  }

  return groups
}

function StarButton({ starred, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={starred ? 'Unstar' : 'Star'}
      className={`shrink-0 p-1 rounded transition-colors ${starred ? 'text-amber-400' : 'text-gray-600 hover:text-gray-300'}`}
    >
      <svg className="w-4 h-4" fill={starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5l2.0 4.06 4.48.65-3.24 3.16.77 4.46-4-2.1-4 2.1.76-4.46L4.0 8.2l4.48-.65 2.0-4.06z" />
      </svg>
    </button>
  )
}

export default function NewsletterList({ newsletters, onSelect, onToggleStar, onArchive, archivedView }) {
  if (newsletters.length === 0) {
    return <p className="p-4 text-gray-500 text-sm">No newsletters found.</p>
  }

  const groups = groupByDate(newsletters)
  const stop = (fn) => (e) => { e.stopPropagation(); fn() }

  return (
    <div>
      {groups.map(group => (
        <div key={group.label}>
          <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900 border-b border-gray-800 sticky top-0">
            {group.label}
          </div>
          <ul>
            {group.items.map(n => {
              const unread = !n.read_at
              return (
                <li key={n.id} className="group flex items-center gap-1 border-b border-gray-800/50 hover:bg-gray-800 transition-colors">
                  <button onClick={() => onSelect(n.id)} className="flex-1 min-w-0 text-left px-4 py-3 flex gap-3 items-center">
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${unread ? 'bg-blue-500' : 'bg-transparent'}`} />
                    <SenderAvatar name={n.from_name} email={n.from_email} />
                    <div className="min-w-0 flex-1">
                      <span className={`text-sm truncate block ${unread ? 'font-bold text-white' : 'font-semibold text-gray-300'}`}>
                        {n.from_name || n.from_email || 'Unknown'}
                      </span>
                      <p className={`text-xs truncate mt-0.5 ${unread ? 'text-gray-300' : 'text-gray-400'}`}>{n.subject}</p>
                    </div>
                    {n.reading_minutes ? (
                      <span className="shrink-0 text-[11px] text-gray-500 tabular-nums">{n.reading_minutes} min</span>
                    ) : null}
                  </button>
                  <div className="flex items-center pr-2 shrink-0">
                    <StarButton starred={!!n.starred} onClick={stop(() => onToggleStar(n.id))} />
                    <button
                      onClick={stop(() => onArchive(n.id))}
                      aria-label={archivedView ? 'Unarchive' : 'Archive'}
                      title={archivedView ? 'Restore' : 'Archive'}
                      className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors md:opacity-0 md:group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {archivedView
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 10l2-5h14l2 5M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9M10 14l2-2m0 0l2 2m-2-2v6" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l-1 12a1 1 0 001 1h12a1 1 0 001-1L19 8M5 8l1-3h12l1 3M10 12h4" />}
                      </svg>
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
