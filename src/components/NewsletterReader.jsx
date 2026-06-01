import { useEffect, useRef, useState } from 'react'

export default function NewsletterReader({ newsletter, onClose, onPrev, onNext, onToggleStar, onArchive, archivedView }) {
  const touchStartX = useRef(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { setLoading(true) }, [newsletter?.id])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && onPrev) onPrev()
      if (e.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    touchStartX.current = null
    if (Math.abs(delta) < 60) return
    if (delta > 0 && onNext) onNext()
    if (delta < 0 && onPrev) onPrev()
  }

  const body = newsletter?.reader_html ?? null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 py-4 flex items-stretch justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Wrapper anchors arrows relative to the card edges */}
      <div className="relative w-full max-w-[90vmin]">

        {/* Card */}
        <div className="relative h-full bg-white rounded-2xl overflow-hidden shadow-2xl">

          {/* Toolbar: star, archive, close */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            {onToggleStar && (
              <button
                onClick={onToggleStar}
                aria-label={newsletter?.starred ? 'Unstar' : 'Star'}
                title={newsletter?.starred ? 'Unstar' : 'Star'}
                className={`w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/30 transition-colors ${newsletter?.starred ? 'text-amber-500' : 'text-gray-700'}`}
              >
                <svg className="w-4 h-4" fill={newsletter?.starred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.5l2.0 4.06 4.48.65-3.24 3.16.77 4.46-4-2.1-4 2.1.76-4.46L4.0 8.2l4.48-.65 2.0-4.06z" />
                </svg>
              </button>
            )}
            {onArchive && (
              <button
                onClick={onArchive}
                aria-label={archivedView ? 'Restore' : 'Archive'}
                title={archivedView ? 'Restore' : 'Archive'}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/30 text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8l-1 12a1 1 0 001 1h12a1 1 0 001-1L19 8M5 8l1-3h12l1 3M10 12h4" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/30 text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Loading state */}
          {!newsletter && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading…
            </div>
          )}

          {/* Content */}
          {body && (
            <iframe
              key={newsletter.id}
              srcDoc={body}
              sandbox="allow-same-origin allow-popups"
              referrerPolicy="no-referrer"
              className="w-full h-full border-0"
              title={newsletter?.subject}
              onLoad={() => setLoading(false)}
            />
          )}
        </div>

        {/* Prev arrow — just outside the left edge of the card */}
        {onPrev && (
          <button
            onClick={onPrev}
            aria-label="Previous newsletter"
            className="absolute top-1/2 -translate-y-1/2 -left-11 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next arrow — just outside the right edge of the card */}
        {onNext && (
          <button
            onClick={onNext}
            aria-label="Next newsletter"
            className="absolute top-1/2 -translate-y-1/2 -right-11 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

      </div>
    </div>
  )
}
