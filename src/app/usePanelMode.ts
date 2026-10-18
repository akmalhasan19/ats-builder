import { useEffect } from 'react'
import { useUiStore, type PanelMode } from '@/store/uiStore'

export const THREE_COL_MIN = 1280
export const ICON_RAIL_MIN = 1024

/** T2.2 — satu sumber kebenaran untuk mode panel, bisa diuji tanpa DOM. */
export function panelModeFor(width: number): PanelMode {
  if (width >= THREE_COL_MIN) return '3col'
  if (width >= ICON_RAIL_MIN) return 'icon-rail'
  return 'tabs'
}

export function usePanelMode(): void {
  const setPanelMode = useUiStore((state) => state.setPanelMode)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const apply = () => setPanelMode(panelModeFor(window.innerWidth))
    apply()

    const queries = [
      window.matchMedia(`(min-width: ${THREE_COL_MIN}px)`),
      window.matchMedia(`(min-width: ${ICON_RAIL_MIN}px)`),
    ]
    for (const query of queries) query.addEventListener('change', apply)
    return () => {
      for (const query of queries) query.removeEventListener('change', apply)
    }
  }, [setPanelMode])
}
