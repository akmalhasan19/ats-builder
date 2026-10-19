import { create } from 'zustand'

export type ErrorBannerKind = 'runtime' | 'quota'

type ErrorStore = {
  banner: ErrorBannerKind | null
  showError: (kind: ErrorBannerKind) => void
  dismissError: () => void
}

/**
 * T9.6 — galat global & penyimpanan penuh dilaporkan lewat banner non-blocking.
 * Detail teknis hanya masuk konsol; UI membawa kalimat tetap dari kamus (P7).
 */
export const useErrorStore = create<ErrorStore>((set) => ({
  banner: null,
  showError: (kind) => set({ banner: kind }),
  dismissError: () => set({ banner: null }),
}))
