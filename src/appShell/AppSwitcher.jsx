import { useEffect, useId, useRef, useState } from 'react'
import { APP_DESTINATIONS, CURRENT_APP_ID, CURRENT_APP_LABEL } from './destinations.js'

export default function AppSwitcher({ placement = 'sidebar' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()
  const isMobile = placement === 'mobile-header'
  const isReader = placement === 'reader-toolbar'

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function focusItem(index) {
    const items = menuRef.current?.querySelectorAll('[role="menuitem"]')
    items?.[index]?.focus()
  }

  function toggleMenu() {
    setOpen(value => {
      const next = !value
      if (next) window.setTimeout(() => focusItem(0), 0)
      return next
    })
  }

  function handleMenuKeyDown(event) {
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])
    if (!items.length) return
    const currentIndex = Math.max(0, items.indexOf(document.activeElement))

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem((currentIndex + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem((currentIndex - 1 + items.length) % items.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusItem(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusItem(items.length - 1)
    }
  }

  function selectCurrentApp(event) {
    event.preventDefault()
    setOpen(false)
    triggerRef.current?.focus()
  }

  const compact = isMobile || isReader

  return (
    <div className={compact ? 'relative shrink-0' : 'relative shrink-0 px-2 pb-3 pt-2'}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
        className={
          compact
            ? 'min-h-11 max-w-[12rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
            : 'min-h-12 w-full rounded-md px-2.5 py-2 text-left text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'
        }
      >
        <span className="flex items-center gap-2">
          <NewsletterIcon className={compact ? 'h-6 w-6 shrink-0 text-blue-600' : 'h-7 w-7 shrink-0 text-blue-400'} />
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Zo-Bot</span>
            <span className={compact ? 'block truncate text-sm font-bold text-slate-900' : 'block truncate text-sm font-bold text-white'}>{CURRENT_APP_LABEL}</span>
          </span>
          <ChevronIcon className={compact ? 'h-4 w-4 shrink-0 text-slate-400' : 'ml-auto h-4 w-4 shrink-0 text-slate-400'} />
        </span>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Switch Zo-Bot app"
          onKeyDown={handleMenuKeyDown}
          className={
            compact
              ? 'absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg'
              : 'absolute left-2 right-2 top-full z-50 rounded-md border border-slate-700 bg-slate-950 p-1.5 shadow-lg'
          }
        >
          {APP_DESTINATIONS.map(destination => {
            const current = destination.id === CURRENT_APP_ID
            const itemClass = current
              ? compact ? 'bg-blue-50 text-blue-700' : 'bg-blue-600 text-white'
              : compact ? 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 focus:bg-slate-800 focus:text-slate-100'
            const content = (
              <>
                <DestinationIcon id={destination.id} className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{destination.label}</span>
                {current && <CheckIcon className="h-4 w-4 shrink-0" />}
              </>
            )

            if (current) {
              return (
                <button
                  key={destination.id}
                  type="button"
                  role="menuitem"
                  aria-current="page"
                  onClick={selectCurrentApp}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${itemClass}`}
                >
                  {content}
                </button>
              )
            }

            return (
              <a
                key={destination.id}
                role="menuitem"
                href={destination.href}
                className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${itemClass}`}
              >
                {content}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DestinationIcon({ id, className }) {
  if (id === 'dashboard') return <DashboardIcon className={className} />
  if (id === 'finance') return <ShieldIcon className={className} />
  if (id === 'travel') return <TravelIcon className={className} />
  if (id === 'newsletters') return <NewsletterIcon className={className} />
  if (id === 'home') return <HomeIcon className={className} />
  return <RecordsIcon className={className} />
}

function ChevronIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
}

function CheckIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
}

function DashboardIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
}

function ShieldIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l8 4v6c0 5-4 9-8 10C8 21 4 17 4 12V6l8-4z" /></svg>
}

function TravelIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92V21a1 1 0 01-1.2.98L3.8 18.5a1 1 0 01-.8-.98V6.48a1 1 0 011.2-.98l17 3.48a1 1 0 01.8.98v2.96" /><path d="M8 7v12M16 9v10" /></svg>
}

function NewsletterIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
}

function HomeIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>
}

function RecordsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></svg>
}
