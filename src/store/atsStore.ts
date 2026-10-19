import { create } from 'zustand'
import type { AtsReport } from '@/features/ats/types'

export type AtsStore = {
  report: AtsReport | null
  isChecking: boolean
  /** Drawer pernah dibuka sesi ini — syarat pemeriksaan ulang otomatis (T7.6). */
  hasOpened: boolean
  lastCheckedAt: number | null
  keywords: string[]
  setReport: (report: AtsReport | null) => void
  setChecking: (isChecking: boolean) => void
  setHasOpened: (hasOpened: boolean) => void
  setLastCheckedAt: (lastCheckedAt: number | null) => void
  setKeywords: (keywords: string[]) => void
}

export const useAtsStore = create<AtsStore>((set) => ({
  report: null,
  isChecking: false,
  hasOpened: false,
  lastCheckedAt: null,
  keywords: [],
  setReport: (report) => set({ report }),
  setChecking: (isChecking) => set({ isChecking }),
  setHasOpened: (hasOpened) => set({ hasOpened }),
  setLastCheckedAt: (lastCheckedAt) => set({ lastCheckedAt }),
  setKeywords: (keywords) => set({ keywords }),
}))
