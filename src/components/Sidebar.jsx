import SenderAvatar from './SenderAvatar.jsx'
import SyncButton from './SyncButton.jsx'

const NAV_ITEMS = [
  { key: 'today', label: 'Today' },
  { key: 'unread', label: 'Unread' },
  { key: 'starred', label: 'Starred' },
  { key: 'archived', label: 'Archived' },
]

function CountBadge({ value }) {
  if (!value) return null
  return <span className="ml-auto rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300 tabular-nums">{value}</span>
}

export default function Sidebar({
  counts,
  senders,
  filter,
  sender,
  onFilterChange,
  onSenderChange,
  onMarkAllRead,
  onSynced,
  expandedSources,
  onToggleSources,
}) {
  const visibleSenders = expandedSources ? senders : senders.slice(0, 8)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-gray-800 bg-gray-950 text-gray-100">
      <div className="px-5 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-white">Newsletters</h1>
      </div>

      <nav className="px-3">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => onFilterChange(item.key)}
            className={`mb-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              filter === item.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-100'
            }`}
          >
            <span>{item.label}</span>
            <CountBadge value={counts?.[item.key]} />
          </button>
        ))}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        <div className="mb-2 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          <span>Sources</span>
          {sender && (
            <button onClick={() => onSenderChange('')} className="text-gray-400 hover:text-white" aria-label="Clear source filter">
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          {visibleSenders.map(s => {
            const active = sender === s.from_email
            return (
              <button
                key={s.from_email}
                onClick={() => onSenderChange(active ? '' : s.from_email)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors ${
                  active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900 hover:text-gray-100'
                }`}
              >
                <SenderAvatar name={s.from_name} email={s.from_email} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{s.from_name || s.from_email}</span>
                {s.unread > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">{s.unread}</span>
                )}
              </button>
            )
          })}
        </div>
        {senders.length > 8 && (
          <button
            onClick={onToggleSources}
            className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-900 hover:text-gray-100"
          >
            {expandedSources ? 'Show fewer sources' : 'View all sources'}
          </button>
        )}
      </div>

      <div className="space-y-3 border-t border-gray-800 p-4">
        <SyncButton onSynced={onSynced} />
        <button
          onClick={onMarkAllRead}
          disabled={!counts?.unread}
          className="w-full rounded-md border border-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-700 hover:bg-gray-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mark all read
        </button>
        <a href="/" className="hidden [@media(display-mode:standalone)]:flex items-center justify-center rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-900 hover:text-gray-200">
          Zo-Bot Home
        </a>
      </div>
    </aside>
  )
}

