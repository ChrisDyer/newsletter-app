export default function AppIdentity({ placement = 'sidebar' }) {
  const sidebar = placement === 'sidebar'
  return <div className={sidebar ? 'px-4 py-4 flex items-center gap-3 text-white' : 'flex items-center gap-2 text-slate-900'} aria-label="Newsletters">
    <svg className="h-7 w-7 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 9 6a2 2 0 0 0 2 0l9-6"/></svg>
    <span className="text-sm font-semibold">Newsletters</span>
  </div>
}
