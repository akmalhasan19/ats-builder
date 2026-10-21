import { useLayoutEffect, useRef } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { useUiStore } from '@/store/uiStore'
import { centerFocusPoint, isNarrowLayout, restorePreviewZoom } from './canvasEditZoom'

/**
 * Addendum FASE 13 — lifecycle zoom & fokus sesi edit di layar sempit.
 *
 * Dua hal yang harus terjadi bersama-sama:
 *
 *  1. **Sesi dibuka** → field yang sedang diedit dipusatkan secara horizontal
 *     di well pratinjau, supaya layar yang dilihat user persis tempat dia
 *     mengetik. Pemusatan berjalan di `useLayoutEffect` supaya terjadi
 *     sebelum browser menggambar frame berikutnya — tanpa kedipan.
 *  2. **Sesi ditutup** → zoom kembali ke skala ringkasan (30%/Fit), seperti
 *     sebelum user menyentuh field.
 *
 * Hook ini dipasang di `PreviewWell` — komponen yang menerapkan transform
 * ke pohon kertas, sehingga pemusatan selalu diukur terhadap skala yang
 * benar-benar terpakai, bukan angka preferensi.
 */
export function useCanvasEditFocus(): void {
  const session = useCanvasStore((state) => state.session)
  const focusPoint = useCanvasStore((state) => state.focusPoint)
  const zoom = useUiStore((state) => state.zoom)
  const fitMode = useUiStore((state) => state.fitMode)
  const wasEditing = useRef(false)

  // Sesi ditutup → kembalikan zoom ringkasan (hanya ada snapshot kalau sesi
  // mobile membawanya, jadi mode desktop tidak pernah tersentuh).
  useLayoutEffect(() => {
    if (wasEditing.current && !session) restorePreviewZoom()
    wasEditing.current = Boolean(session)
  }, [session])

  // Sesi terbuka → pusatkan field yang diedit. Effect ini ikut jalan saat
  // zoom berubah (mis. user memperbesar sendiri), supaya field tetap di
  // tengah layar.
  //
  // Pemusatan hanya berlaku di layar sempit: di desktop kertas muat di layar,
  // jadi guard zoom (D7, sekali per sesi aplikasi) tetap berlaku tanpa
  // memindahkan pandangan.
  useLayoutEffect(() => {
    if (!session || !isNarrowLayout()) return
    centerFocusPoint(focusPoint)
  }, [session, focusPoint, zoom, fitMode])
}
