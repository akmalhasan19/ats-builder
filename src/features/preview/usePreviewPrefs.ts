import { useEffect, useRef } from 'react'
import { PREFS_KEY, readValue, writeValue } from '@/features/persistence/idb'
import { useUiStore } from '@/store/uiStore'

type PreviewPrefs = {
  zoom: number
  fitMode: boolean
  showMarginGuides: boolean
  showKeywordMarks: boolean
}

/**
 * T4.1 — preferensi preview (`ats:prefs:v1`) dimuat sekali dari IndexedDB lalu
 * ikut uiStore, supaya toolbar dan renderer membaca satu sumber yang sama.
 */
export function usePreviewPrefs(): void {
  const zoom = useUiStore((state) => state.zoom)
  const fitMode = useUiStore((state) => state.fitMode)
  const showMarginGuides = useUiStore((state) => state.showMarginGuides)
  const showKeywordMarks = useUiStore((state) => state.showKeywordMarks)
  const loaded = useRef(false)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const stored = await readValue<Partial<PreviewPrefs>>(PREFS_KEY)
        if (!active || !stored) return
        const store = useUiStore.getState()
        if (typeof stored.zoom === 'number') store.setZoom(stored.zoom)
        if (typeof stored.fitMode === 'boolean') store.setFitMode(stored.fitMode)
        if (typeof stored.showMarginGuides === 'boolean')
          store.setShowMarginGuides(stored.showMarginGuides)
        if (typeof stored.showKeywordMarks === 'boolean')
          store.setShowKeywordMarks(stored.showKeywordMarks)
      } catch {
        // Preferensi tidak kritis; uiStore tetap jadi sumber kebenaran sesi ini.
      } finally {
        loaded.current = true
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    void writeValue(PREFS_KEY, { zoom, fitMode, showMarginGuides, showKeywordMarks }).catch(
      () => undefined,
    )
  }, [zoom, fitMode, showMarginGuides, showKeywordMarks])
}
