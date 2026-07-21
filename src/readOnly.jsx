import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiUrl, setApiReadOnly } from './api.js'

const ReadOnlyContext = createContext({ email: null, readOnly: false })

export function ReadOnlyProvider({ children }) {
  const [state, setState] = useState({ email: null, readOnly: false })

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/me'))
      .then(res => {
        if (!res.ok) throw new Error('Could not load user role')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        const next = { email: data.email ?? null, readOnly: Boolean(data.readOnly) }
        setState(next)
        setApiReadOnly(next.readOnly)
      })
      .catch(() => {
        if (!cancelled) {
          setState({ email: null, readOnly: false })
          setApiReadOnly(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  const value = useMemo(() => state, [state])
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>
}

export function useReadOnly() {
  return useContext(ReadOnlyContext)
}
