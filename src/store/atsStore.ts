import { create } from 'zustand'

export type AtsStore = {
  // Bentuk laporan didefinisikan engine Fase 7; fase ini hanya menyediakan
  // tempat simpannya tanpa mengarang struktur lebih dulu.
  report: unknown
  isChecking: boolean
  lastCheckedAt: number | null
  keywords: string[]
  setReport: (report: unknown) => void
  setChecking: (isChecking: boolean) => void
  setLastCheckedAt: (lastCheckedAt: number | null) => void
  setKeywords: (keywords: string[]) => void
}

export const useAtsStore = create<AtsStore>((set) => ({
  report: null,
  isChecking: false,
  lastCheckedAt: null,
  keywords: [],
  setReport: (report) => set({ report }),
  setChecking: (isChecking) => set({ isChecking }),
  setLastCheckedAt: (lastCheckedAt) => set({ lastCheckedAt }),
  setKeywords: (keywords) => set({ keywords }),
}))
