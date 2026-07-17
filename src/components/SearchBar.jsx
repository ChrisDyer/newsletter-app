import { forwardRef } from 'react'

function SearchBar({ query, onChange, className = '' }, ref) {
  return (
    <div className={`relative ${className}`}>
      <svg className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder="Search newsletters..."
        className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-950 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
      />
    </div>
  )
}

export default forwardRef(SearchBar)