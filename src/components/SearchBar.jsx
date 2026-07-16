import { forwardRef } from 'react'

function SearchBar({ query, onChange, className = '' }, ref) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        ref={ref}
        type="search"
        value={query}
        onChange={e => onChange(e.target.value)}
        placeholder="Search newsletters..."
        className="w-full pl-8 pr-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>
  )
}

export default forwardRef(SearchBar)