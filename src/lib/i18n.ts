import { id, type TranslationKey } from '@/dictionaries/id'

/**
 * Penerjemah minimal (P7). Bahasa default `id`; `en` menyusul di Fase 11.
 * Fase 1 (T1.4) memperluas modul ini dengan pemilihan bahasa + format tanggal.
 */
export function t(key: TranslationKey): string {
  return id[key]
}

export type { TranslationKey }
