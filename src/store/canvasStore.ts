import { create } from 'zustand'

export type CanvasSessionKind = 'input' | 'textarea' | 'dates' | 'chips'

export type CanvasSession = {
  blockKey: string
  sectionId: string
  entryId?: string
  fieldPath: string
  kind: CanvasSessionKind
}

/**
 * Titik fokus field yang sedang diedit, dalam **koordinat kertas** — yaitu
 * koordinat yang tidak ikut berubah saat zoom. Kertas diskalakan dengan
 * `transform: scale()`, jadi koordinat kertas = jarak titik dari tepi konten
 * dibagi skala saat pengukuran.
 */
export type CanvasFocusPoint = { x: number; y: number }

/**
 * Snapshot zoom sebelum sesi edit dibuka (dipakai untuk kembali ke zoom
 * ringkasan setelah edit selesai). `during` menyimpan zoom yang dipasang
 * selama sesi, supaya perubahan manual pengguna tidak ditimpa saat restore.
 */
export type CanvasZoomSnapshot = {
  /** Keadaan zoom sebelum sesi edit dibuka. */
  before: { zoom: number; fitMode: boolean }
  /** Keadaan zoom yang dipasang selama sesi edit. */
  during: { zoom: number; fitMode: boolean } | null
}

export type CanvasStore = {
  session: CanvasSession | null
  modeHintSeen: boolean
  /** D7 — zoom sudah pernah dinaikkan otomatis sekali per sesi aplikasi. */
  zoomRaised: boolean
  /** Field yang sedang diedit & titik fokusnya (koordinat kertas). */
  focusPoint: CanvasFocusPoint | null
  /** Snapshot zoom ringkasan sebelum sesi edit (hanya diisi di layar sempit). */
  preEditZoom: CanvasZoomSnapshot | null
  openSession: (session: CanvasSession) => void
  closeSession: () => void
  markModeHintSeen: () => void
  markZoomRaised: () => void
  setFocusPoint: (point: CanvasFocusPoint | null) => void
  setPreEditZoom: (snapshot: CanvasZoomSnapshot | null) => void
}

/**
 * C1.2 — state sesi edit on-canvas dipisah dari `uiStore` supaya hanya blok
 * yang sedang diedit yang berlangganan (D13); draft teks tetap state lokal
 * komponen editor, bukan di sini.
 *
 * C3 — sesi yang terbuka membekukan laporan tinggi blok (D6) dan menjaga
 * zoom tetap terbaca (D7); keduanya dibaca dari modul lain, jadi store ini
 * cukup menyimpan statusnya.
 *
 * Addendum FASE 13 — di layar sempit, sesi edit memakai zoom khusus (75%)
 * dan mengembalikan zoom ringkasan saat sesi ditutup. Snapshot zoom dan titik
 * fokus disimpan di sini supaya satu sumber kebenaran untuk lifecycle sesi.
 */
export const useCanvasStore = create<CanvasStore>((set) => ({
  session: null,
  modeHintSeen: false,
  zoomRaised: false,
  focusPoint: null,
  preEditZoom: null,
  openSession: (session) => set({ session }),
  closeSession: () => set({ session: null, focusPoint: null }),
  markModeHintSeen: () => set({ modeHintSeen: true }),
  markZoomRaised: () => set({ zoomRaised: true }),
  setFocusPoint: (point) => set({ focusPoint: point }),
  setPreEditZoom: (snapshot) => set({ preEditZoom: snapshot }),
}))
