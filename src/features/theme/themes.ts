import type { TranslationKey } from '@/lib/i18n'

/**
 * Katalog tema warna. Nilai palette sebenarnya ada di `src/styles/themes.css`
 * (satu blok `:root[data-theme='…']` per tema); di sini hanya metadata yang
 * dibutuhkan UI + pratinjau swatch. `tests/unit/theme.test.ts` memastikan
 * `accent`/`secondary` di sini sama persis dengan blok CSS-nya.
 */
export type ThemeId = 'vetra' | 'cobalt' | 'emerald' | 'violet' | 'rose' | 'graphite'

export type ThemeDefinition = {
  id: ThemeId
  labelKey: TranslationKey
  /** Warna aksen (isian tombol, border aktif, indikator). */
  accent: string
  /** Warna pendamping (surface mesin / Parse Tape). */
  secondary: string
}

export const THEMES: readonly ThemeDefinition[] = [
  { id: 'vetra', labelKey: 'theme.vetra', accent: '#FF6E00', secondary: '#0F3D4C' },
  { id: 'cobalt', labelKey: 'theme.cobalt', accent: '#2563EB', secondary: '#131C3A' },
  { id: 'emerald', labelKey: 'theme.emerald', accent: '#059669', secondary: '#0C3B31' },
  { id: 'violet', labelKey: 'theme.violet', accent: '#7C3AED', secondary: '#2A1A4A' },
  { id: 'rose', labelKey: 'theme.rose', accent: '#E11D48', secondary: '#3B1220' },
  { id: 'graphite', labelKey: 'theme.graphite', accent: '#475569', secondary: '#0F172A' },
]

/** Tema utama = warna merek Vetra. */
export const DEFAULT_THEME: ThemeId = 'vetra'

/** Kunci localStorage; juga dibaca skrip pra-paint di index.html. */
export const THEME_STORAGE_KEY = 'vetra:theme'

const THEME_IDS: ReadonlySet<string> = new Set(THEMES.map((theme) => theme.id))

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.has(value)
}

export function getTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]!
}

/** localStorage bisa melempar (mode privat / kebijakan situs); tema tidak kritis. */
export function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeId(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function storeTheme(id: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    // Preferensi tetap hidup di memori selama sesi ini.
  }
}
