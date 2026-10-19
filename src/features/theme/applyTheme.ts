import { getTheme, type ThemeId } from './themes'

/**
 * Menulis tema ke `<html data-theme>` — satu-satunya titik yang menyentuh DOM
 * untuk tema. CSS di `src/styles/themes.css` yang menentukan warnanya, jadi
 * fungsi ini tidak menyentuh style inline sama sekali.
 *
 * `meta[theme-color]` ikut diperbarui supaya bilah peramban di ponsel memakai
 * warna aksen tema aktif.
 */
export function applyTheme(id: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = id
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', getTheme(id).accent)
}
