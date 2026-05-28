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
    let d
    try { d = new Date(n.date) } catch { d = new Date(0) }
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

export default function NewsletterList({ newsletters, onSelect }) {
  if (newsletters.length === 0) {
    return <p className="p-4 text-gray-500 text-sm">No newsletters found.</p>
  }

  const groups = groupByDate(newsletters)

  return (
    <div>
      {groups.map(group => (
        <div key={group.label}>
          <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900 border-b border-gray-800 sticky top-0">
            {group.label}
          </div>
          <ul>
            {group.items.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => onSelect(n.id)}
                  className="w-full text-left px-4 py-3 flex gap-3 items-center hover:bg-gray-800 transition-colors border-b border-gray-800/50"
                >
                  <SenderAvatar name={n.from_name} email={n.from_email} />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-100 truncate block">
                      {n.from_name || n.from_email || 'Unknown'}
                    </span>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{n.subject}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
