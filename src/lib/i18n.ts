import { en } from '@/dictionaries/en'
import { id, type TranslationKey } from '@/dictionaries/id'

export type Lang = 'id' | 'en'

const dictionaries: Record<Lang, Partial<Record<TranslationKey, string>>> = { id, en }

let lang: Lang = 'id'

export function getLang(): Lang {
  return lang
}

export function setLang(next: Lang): void {
  lang = next
}

/**
 * Penerjemah (P7). Bahasa default `id`; kamus `en` diisi di Fase 11, jadi
 * kunci yang belum ada selalu jatuh balik ke `id`.
 */
export function t(key: TranslationKey): string {
  return dictionaries[lang][key] ?? id[key]
}

export type { TranslationKey }
