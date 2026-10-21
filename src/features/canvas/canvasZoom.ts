import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { useCanvasStore } from '@/store/canvasStore'
import { useUiStore } from '@/store/uiStore'

/**
 * C3.3 — guard zoom (D7).
 *
 * Editor yang hidup di dalam pohon terskala ikut mengecil; di bawah 60% teks
 *nya tak terbaca. Jadi begitu sesi dibuka, zoom dinaikkan ke 75% — **sekali
 * saja** per sesi aplikasi, supaya user yang memang memperkecil setelahnya
 * tidak dipaksa balik.
 */

const MIN_READABLE_ZOOM = 0.6
const RAISED_ZOOM = 0.75

/**
 * Skala efektif pohon pratinjau. `PreviewWell` menykalakan seluruh isi dengan
 * `transform: scale(z)` (origin top-left), jadi skalanya dibaca dari matriks
 * transform — bukan dari nilai preferensi, karena mode Fit memakai skala yang
 * dihitung dari lebar well.
 */
export const effectiveScaleOf = (element: HTMLElement | null): number => {
  if (!element) return 1
  const scaled = element.closest<HTMLElement>('[data-probe="preview-content"]')
  if (!scaled) return 1
  const transform = getComputedStyle(scaled).transform
  const match = /^matrix\(([^,]+)/.exec(transform)
  if (!match) return 1
  const scale = Number(match[1])
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/** Naikkan zoom sekali saja bila skala effective terlalu kecil untuk diedit. */
export const ensureReadableZoom = (element: HTMLElement | null): void => {
  const canvas = useCanvasStore.getState()
  if (canvas.zoomRaised) return
  if (effectiveScaleOf(element) >= MIN_READABLE_ZOOM) return
  canvas.markZoomRaised()
  const ui = useUiStore.getState()
  ui.setFitMode(false)
  ui.setZoom(RAISED_ZOOM)
  toast(t('canvas.zoomRaised'))
}
