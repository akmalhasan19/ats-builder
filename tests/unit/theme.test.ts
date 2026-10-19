import { describe, expect, it } from 'vitest'
import { contrastRatio } from '@/lib/contrast'
import { DEFAULT_THEME, THEMES, isThemeId } from '@/features/theme/themes'
import { useThemeStore } from '@/store/themeStore'
import { applyTheme } from '@/features/theme/applyTheme'
import { DEFAULT_PALETTE, readThemePalettes } from '../fixtures/themePalettes'

const RAISED = '#ffffff'
const SURFACE = '#f7f8fa'
const SUNKEN = '#edf0f4'
const MACHINE_TEXT = '#e8edf4'

const ratio = (a: string, b: string): number => {
  const value = contrastRatio(a, b)
  if (value === null) throw new Error(`hex tidak valid: ${a} / ${b}`)
  return value
}

describe('katalog tema', () => {
  const palettes = readThemePalettes()

  it('setiap tema di themes.ts punya blok CSS, dan sebaliknya', () => {
    expect(palettes.map((palette) => palette.id)).toEqual(THEMES.map((theme) => theme.id))
  })

  it('swatch di themes.ts tidak menyimpang dari palette CSS', () => {
    for (const theme of THEMES) {
      const palette = palettes.find((item) => item.id === theme.id)
      if (!palette) throw new Error(`palette ${theme.id} tidak ditemukan`)
      expect(theme.accent.toLowerCase()).toBe(palette.accent)
      expect(theme.secondary.toLowerCase()).toBe(palette.secondary)
    }
  })

  it('tema default adalah Vetra dengan aksen merek #FF6E00', () => {
    expect(DEFAULT_THEME).toBe('vetra')
    expect(DEFAULT_PALETTE.accent).toBe('#ff6e00')
  })

  it('hanya id yang terdaftar yang diterima', () => {
    expect(isThemeId('rose')).toBe(true)
    expect(isThemeId('neon')).toBe(false)
    expect(isThemeId(null)).toBe(false)
  })
})

describe('kontras setiap tema (WCAG AA)', () => {
  for (const palette of readThemePalettes()) {
    it(`${palette.id}: teks di atas aksen & wash lolos 4.5:1`, () => {
      expect(
        ratio(palette.accentOn, palette.accent),
        `teks ${palette.accentOn} di atas ${palette.accent}`,
      ).toBeGreaterThanOrEqual(4.5)
      for (const base of [RAISED, SURFACE, SUNKEN, palette.accentWash]) {
        expect(
          ratio(palette.accentInk, base),
          `accent-ink ${palette.accentInk} di atas ${base}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`${palette.id}: garis & cincin fokus memakai accent-ink (≥3:1)`, () => {
      // `accent` hanya untuk isian; border/ring memakai accent-ink supaya
      // komponen tetap terlihat di atas chrome terang.
      for (const base of [RAISED, SURFACE]) {
        expect(
          ratio(palette.accentInk, base),
          `accent-ink ${palette.accentInk} di atas ${base}`,
        ).toBeGreaterThanOrEqual(3)
      }
    })

    it(`${palette.id}: surface mesin tetap terbaca`, () => {
      expect(ratio(MACHINE_TEXT, palette.secondary)).toBeGreaterThanOrEqual(4.5)
      expect(ratio(palette.secondaryDim, palette.secondary)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${palette.id}: state hover/aktif berbeda dari aksen dasar`, () => {
      expect(palette.accentActive).not.toBe(palette.accent)
      expect(ratio(palette.accentActive, palette.accent)).toBeGreaterThan(1.1)
    })
  }
})

describe('themeStore', () => {
  it('menyimpan pilihan ke localStorage dan mengabaikan id tak dikenal', () => {
    window.localStorage.clear()
    useThemeStore.getState().setThemeId('rose')
    expect(useThemeStore.getState().themeId).toBe('rose')
    expect(window.localStorage.getItem('vetra:theme')).toBe('rose')

    useThemeStore.getState().setThemeId('neon' as never)
    expect(useThemeStore.getState().themeId).toBe('rose')
  })

  it('applyTheme menulis data-theme dan meta theme-color', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#f7f8fa" />'
    applyTheme('cobalt')
    expect(document.documentElement.dataset.theme).toBe('cobalt')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#2563EB',
    )
  })
})
