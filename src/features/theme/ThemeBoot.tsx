import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'
import { applyTheme } from './applyTheme'

/**
 * Menyinkronkan `themeId` di store dengan `<html data-theme>`. Atribut awal
 * sudah dipasang skrip pra-paint di index.html; komponen ini yang menjaga
 * perubahan berikutnya (dan memperbarui `meta[theme-color]`).
 */
export function ThemeBoot() {
  const themeId = useThemeStore((state) => state.themeId)

  useEffect(() => {
    applyTheme(themeId)
  }, [themeId])

  return null
}
