import { parseHTML } from 'linkedom'

function formatDate(str) {
  try {
    return new Date(str).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return str || '' }
}

const SHELL_CSS = `
  html { margin: 0; padding: 0; }
  body {
    margin: 0 !important;
    padding: 20px 40px 24px !important;
    overflow-x: hidden;
    box-sizing: border-box;
  }
  img { max-width: 100% !important; height: auto !important; }

  .nl-dateline { text-align: center; padding: 20px 0 0; font-family: system-ui, sans-serif; }
  .nl-sender   { font-size: 0.85em; font-weight: 600; color: #333; text-transform: uppercase; letter-spacing: 0.08em; }
  .nl-date     { font-size: 0.75em; color: #999; margin-top: 4px; letter-spacing: 0.03em; }
  .nl-rule     { border: none; border-top: 1px solid #e8e8e8; margin: 16px 0 0; }
`

// Remove fixed pixel-width constraints from email layout elements so the
// content flows to fit the viewport instead of overflowing at 600-640px.
// Also strips "View in browser" rows and images without image file extensions.
// Returns email's own <style> tags separately so they land in <head>.
function makeEmailResponsive(bodyHtml) {
  const { document } = parseHTML(bodyHtml)

  // 1. Strip fixed pixel widths from layout elements
  for (const el of document.querySelectorAll('table, td, th, div, center')) {
    const w = el.getAttribute('width')
    if (w && /^\d+$/.test(w.trim()) && parseInt(w) > 100) {
      el.setAttribute('width', '100%')
    }
    const style = el.getAttribute('style')
    if (style) {
      const updated = style
        .replace(/\bwidth\s*:\s*\d{3,}px\b/gi, 'width:100%')
        .replace(/\bmax-width\s*:\s*\d{3,}px\b/gi, 'max-width:100%')
        .replace(/\bmin-width\s*:\s*\d{3,}px\b/gi, '')
      if (updated !== style) el.setAttribute('style', updated)
    }
  }

  // 2. Remove "View in browser" / "View online" links and their table row.
  //    If the row contains meaningful images (logos etc.) only remove the <a>
  //    itself; otherwise remove the whole <tr> so sibling date text goes too.
  const hasLogoImages = el => [...el.querySelectorAll('img')].some(img =>
    /\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/i.test(img.getAttribute('src') || ''))
  for (const a of document.querySelectorAll('a')) {
    if (/view\s+(this\s+email\s+)?(in\s+(your\s+)?(browser|web)|online)/i.test(a.textContent.trim())) {
      const row = a.closest('tr')
      if (row && hasLogoImages(row)) {
        a.remove()           // keep the row — it has logos in sibling cells
      } else {
        (row ?? a.closest('td') ?? a).remove()   // no logos, safe to nuke the row
      }
    }
  }

  // 3. Remove sponsored / native-ad blocks (e.g. WSJ "Sponsored by CDW")
  for (const el of document.querySelectorAll('.sponsor, .native-ad')) {
    (el.closest('tr') ?? el).remove()
  }

  // 4. Remove images whose src has no image file extension — these are
  //    tracking pixels and dynamic analytics beacons (e.g. sli.bloomberg.com/imp?)
  //    that break when the personalised URL expires.
  for (const img of document.querySelectorAll('img')) {
    const src = img.getAttribute('src') || ''
    if (src && !/\.(png|jpg|jpeg|gif|webp|svg|ico)(\?|$)/i.test(src)) {
      img.remove()
    }
  }

  // Hoist the email's own embedded styles into our <head> so they aren't
  // parsed as body content (avoids nested-document weirdness).
  const emailStyles = [...(document.querySelectorAll('head > style') ?? [])]
    .map(el => el.outerHTML)
    .join('\n')

  const bodyContent = document.body?.innerHTML ?? document.toString()

  return { emailStyles, bodyContent }
}

function dateline(fromName, date) {
  const sender = fromName ? `<div class="nl-sender">${fromName}</div>` : ''
  const dateStr = date ? `<div class="nl-date">${formatDate(date)}</div>` : ''
  if (!sender && !dateStr) return ''
  return `<div class="nl-dateline">${sender}${dateStr}</div><hr class="nl-rule">`
}

export function toReaderHtml(bodyHtml, bodyText, { fromName, date } = {}) {
  if (bodyHtml) {
    try {
      const { emailStyles, bodyContent } = makeEmailResponsive(bodyHtml)
      const header = dateline(fromName, date)
      return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${SHELL_CSS}</style>${emailStyles}</head><body>${header}${bodyContent}</body></html>`
    } catch (err) {
      console.warn('[readability] responsive pass failed:', err.message)
    }
  }

  // Fallback: plain text
  const header = dateline(fromName, date)
  const text = bodyText || 'No content available.'
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${SHELL_CSS} body{font-family:system-ui,sans-serif;} pre{white-space:pre-wrap;font-family:inherit;}</style></head><body>${header}<pre>${escaped}</pre></body></html>`
}
