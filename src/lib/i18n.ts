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
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = dictionaries[lang][key] ?? id[key] ?? key
  if (params && text) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return text
}

/**
 * Pencarian kunci opsional: mengembalikan `undefined` bila kunci tidak ada di
 * kamus. Dipakai untuk struktur override berjenjang (mis. guide per template:
 * `canvas.guide.<templateId>.*` → fallback `canvas.guide.*`) — P7 tetap
 * berlaku karena teks yang tampil tetap berasal dari kamus.
 */
export function tMaybe(key: string): string | undefined {
  return dictionaries[lang][key as TranslationKey] ?? (id as Record<string, string>)[key]
}

export type { TranslationKey }
