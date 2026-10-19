import { useEffect, useState } from 'react'

/** §2.4 — ≥1600px drawer ATS menjadi kolom ke-4, bukan overlay. */
export const ATS_DOCK_MIN = 1600

export function useAtsDocked(): boolean {
  const [docked, setDocked] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(`(min-width: ${ATS_DOCK_MIN}px)`)
    const apply = () => setDocked(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return docked
}
