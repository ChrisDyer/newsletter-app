import AppSwitcher from '../appShell/AppSwitcher.jsx'
import SenderAvatar from './SenderAvatar.jsx'
import SyncButton from './SyncButton.jsx'

const NAV_ITEMS = [
  { key: 'today', label: 'Today' },
  { key: 'unread', label: 'Unread' },
  { key: 'starred', label: 'Starred' },
  { key: 'archived', label: 'Archived' },
]

function CountBadge({ value, active = false }) {
  if (!value) return null
  return <span className={`ml-auto rounded-full px-2 py-0.5 text-xs tabular-nums ${active ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'}`}>{value}</span>
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
  showAppSwitcher = true,
}) {
  const visibleSenders = expandedSources ? senders : senders.slice(0, 8)

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100">
      {showAppSwitcher ? (
        <AppSwitcher placement="sidebar" />
      ) : (
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-white">Newsletter menu</h2>
          <p className="mt-1 text-xs text-slate-400">Filters and sources</p>
        </div>
      )}

      <nav className="px-3" aria-label="Newsletter filters">
        {NAV_ITEMS.map(item => {
          const active = filter === item.key
          return (
            <button
              key={item.key}
              onClick={() => onFilterChange(item.key)}
              className={`mb-1 flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span>{item.label}</span>
              <CountBadge value={counts?.[item.key]} active={active} />
            </button>
          )
        })}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        <div className="mb-2 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Sources</span>
          {sender && (
            <button onClick={() => onSenderChange('')} className="text-slate-400 hover:text-white" aria-label="Clear source filter">
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
                className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
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
            className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            {expandedSources ? 'Show fewer sources' : 'View all sources'}
          </button>
        )}
      </div>

      <div className="space-y-3 border-t border-slate-800 p-4">
        <SyncButton onSynced={onSynced} />
        <button
          onClick={onMarkAllRead}
          disabled={!counts?.unread}
          className="w-full rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>
    </aside>
  )
}