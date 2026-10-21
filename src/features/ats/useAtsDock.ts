import { useEffect, useState } from 'react'
import { useUiStore, type EditMode } from '@/store/uiStore'

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

/**
 * FASE 13 — D9 — layar penuh berarti SATU pane: di mode kanvas dengan
 * preferensi layar penuh menyala, drawer tidak boleh mengambil kolom ke-4
 * walau lebarnya ≥1600px. Ia menimpa kertas dari sisi kanan lewat `AtsOverlay`.
 */
export const atsDockedFor = (
  editMode: EditMode,
  canvasFullscreen: boolean,
  docked: boolean,
): boolean => docked && !(editMode === 'canvas' && canvasFullscreen)

/** Lebar boleh dock, dan mode tidak memaksa satu pane? */
export function useAtsDockEligible(): boolean {
  const docked = useAtsDocked()
  const editMode = useUiStore((state) => state.editMode)
  const canvasFullscreen = useUiStore((state) => state.canvasFullscreen)
  return atsDockedFor(editMode, canvasFullscreen, docked)
}
