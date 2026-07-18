import { useEffect, useId, useRef, useState } from 'react'
import { APP_DESTINATIONS, CURRENT_APP_ID, CURRENT_APP_LABEL } from './destinations'

export default function AppSwitcher({ placement = 'sidebar' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()
  // 'reader-toolbar' is the full-screen reader's compact affordance; it presents like
  // the mobile-header pill (same trigger + dropdown).
  const isMobile = placement === 'mobile-header' || placement === 'reader-toolbar'

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event) {
      if (
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
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

  function handleMenuKeyDown(event) {
    const items = Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])
    const currentIndex = items.indexOf(document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem((currentIndex + 1 + items.length) % items.length)
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

  function toggleMenu() {
    setOpen(value => {
      const next = !value
      if (next) window.setTimeout(() => focusItem(0), 0)
      return next
    })
  }

  return (
    <div className={isMobile ? 'relative shrink-0' : 'relative px-2 pt-2 pb-3 shrink-0'}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
        className={
          isMobile
            ? 'min-h-11 max-w-[11rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'
            : 'w-full min-h-12 rounded-md px-2.5 py-2 text-left text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'
        }
      >
        <span className="flex items-center gap-2">
          <DestinationIcon id={CURRENT_APP_ID} className={isMobile ? 'h-6 w-6 shrink-0 text-blue-600' : 'h-7 w-7 shrink-0 text-blue-400'} />
          <span className="min-w-0">
            <span className={isMobile ? 'block text-[10px] font-semibold uppercase tracking-wide text-slate-500' : 'block text-[10px] font-semibold uppercase tracking-wide text-slate-400'}>
              Zo-Bot
            </span>
            <span className={isMobile ? 'block truncate text-sm font-bold text-slate-900' : 'block truncate text-sm font-bold text-white'}>
              {CURRENT_APP_LABEL}
            </span>
          </span>
          <ChevronIcon className={isMobile ? 'h-4 w-4 shrink-0 text-slate-400' : 'ml-auto h-4 w-4 shrink-0 text-slate-400'} />
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
            isMobile
              ? 'absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-700 bg-slate-950 p-1.5 shadow-lg'
              : 'absolute left-2 right-2 top-full z-50 rounded-md border border-slate-700 bg-slate-950 p-1.5 shadow-lg'
          }
        >
          {APP_DESTINATIONS.map(destination => {
            const current = destination.id === CURRENT_APP_ID
            const className = current
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 focus:bg-slate-800 focus:text-slate-100'
            return (
              <a
                key={destination.id}
                role="menuitem"
                aria-current={current ? 'page' : undefined}
                href={destination.href}
                className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${className}`}
              >
                <DestinationIcon id={destination.id} className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{destination.label}</span>
                {current && <CheckIcon className="h-4 w-4 shrink-0" />}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Canonical destination glyphs — lucide path data embedded locally per the app-shell
   contract's Presentation appendix (glyph parity without an icon dependency). */
function DestinationIcon({ id, className }) {
  if (id === 'dashboard') return <DashboardGlyph className={className} />
  if (id === 'finance') return <FinanceGlyph className={className} />
  if (id === 'travel') return <TravelGlyph className={className} />
  if (id === 'newsletters') return <NewslettersGlyph className={className} />
  if (id === 'home') return <HomeGlyph className={className} />
  return <RecordsGlyph className={className} />
}

function Glyph({ className, children }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

function DashboardGlyph({ className }) {
  return (
    <Glyph className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </Glyph>
  )
}

function FinanceGlyph({ className }) {
  return (
    <Glyph className={className}>
      <rect width="20" height="12" x="2" y="6" rx="2" /><circle cx="12" cy="12" r="2" /><path d="M6 12h.01M18 12h.01" />
    </Glyph>
  )
}

function TravelGlyph({ className }) {
  return (
    <Glyph className={className}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </Glyph>
  )
}

function NewslettersGlyph({ className }) {
  return (
    <Glyph className={className}>
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" />
    </Glyph>
  )
}

function HomeGlyph({ className }) {
  return (
    <Glyph className={className}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Glyph>
  )
}

function RecordsGlyph({ className }) {
  return (
    <Glyph className={className}>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </Glyph>
  )
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}
