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
  openSession: (session: CanvasSession) => void
  closeSession: () => void
  markModeHintSeen: () => void
}

/**
 * C1.2 — state sesi edit on-canvas dipisah dari `uiStore` supaya hanya blok
 * yang sedang diedit yang berlangganan (D13); draft teks tetap state lokal
 * komponen editor, bukan di sini.
 */
export const useCanvasStore = create<CanvasStore>((set) => ({
  session: null,
  modeHintSeen: false,
  openSession: (session) => set({ session }),
  closeSession: () => set({ session: null }),
  markModeHintSeen: () => set({ modeHintSeen: true }),
}))
