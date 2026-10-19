import { create } from 'zustand'
import {
  DEFAULT_THEME,
  isThemeId,
  readStoredTheme,
  storeTheme,
  type ThemeId,
} from '@/features/theme/themes'

export type ThemeStore = {
  themeId: ThemeId
  setThemeId: (themeId: ThemeId) => void
}

/**
 * Pilihan tema dipakai lintas halaman (editor, galeri, halaman legal) dan
 * disimpan di localStorage supaya sudah aktif sebelum React mount — skrip
 * pra-paint di index.html membaca kunci yang sama.
 */
export const useThemeStore = create<ThemeStore>((set) => ({
  themeId: typeof window === 'undefined' ? DEFAULT_THEME : readStoredTheme(),
  setThemeId: (themeId) => {
    if (!isThemeId(themeId)) return
    storeTheme(themeId)
    set({ themeId })
  },
}))
