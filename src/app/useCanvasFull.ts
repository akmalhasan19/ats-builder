import { useUiStore } from '@/store/uiStore'
import { canvasFullFor } from './useWorkspaceLayout'

/**
 * FASE 13 — D2 — sumber tunggal status "kertas layar penuh".
 *
 * Fase 1–2 memakai D1: layar penuh **diimplikasikan** `editMode === 'canvas'`
 * sehingga belum ada yang bisa dimatikan. Fase 3 menambahkan preferensi
 * `canvasFullscreen` di `uiStore` (default `true`, dipersistensi di
 * `ats:prefs:v1` lewat `usePreviewPrefs`); hanya isi `useCanvasFullscreen`
 * yang berubah — seluruh pemanggil tetap sama.
 */

/** Preferensi "kertas layar penuh" yang sedang berlaku. */
export function useCanvasFullscreen(): boolean {
  return useUiStore((state) => state.canvasFullscreen)
}

/** Layar penuh aktif? Satu sumber kebenaran untuk shell, pratinjau & menu. */
export function useCanvasFull(): boolean {
  const editMode = useUiStore((state) => state.editMode)
  const canvasFullscreen = useCanvasFullscreen()
  return canvasFullFor(editMode, canvasFullscreen)
}
