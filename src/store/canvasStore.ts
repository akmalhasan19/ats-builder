import { create } from 'zustand'

export type CanvasSessionKind = 'input' | 'textarea' | 'dates' | 'chips'

export type CanvasSession = {
  blockKey: string
  sectionId: string
  entryId?: string
  fieldPath: string
  kind: CanvasSessionKind
}

export type CanvasStore = {
  session: CanvasSession | null
  modeHintSeen: boolean
  /** D7 — zoom sudah pernah dinaikkan otomatis sekali per sesi aplikasi. */
  zoomRaised: boolean
  openSession: (session: CanvasSession) => void
  closeSession: () => void
  markModeHintSeen: () => void
  markZoomRaised: () => void
}

/**
 * C1.2 — state sesi edit on-canvas dipisah dari `uiStore` supaya hanya blok
 * yang sedang diedit yang berlangganan (D13); draft teks tetap state lokal
 * komponen editor, bukan di sini.
 *
 * C3 — sesi yang terbuka membekukan laporan tinggi blok (D6) dan menjaga
 * zoom tetap terbaca (D7); keduanya dibaca dari modul lain, jadi store ini
 * cukup menyimpan statusnya.
 */
export const useCanvasStore = create<CanvasStore>((set) => ({
  session: null,
  modeHintSeen: false,
  zoomRaised: false,
  openSession: (session) => set({ session }),
  closeSession: () => set({ session: null }),
  markModeHintSeen: () => set({ modeHintSeen: true }),
  markZoomRaised: () => set({ zoomRaised: true }),
}))
