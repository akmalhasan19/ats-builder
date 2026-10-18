import type { TranslationKey } from './id'

/**
 * Stub Bahasa Inggris. Terisi penuh di Fase 11 (T11.i18n); `t()` jatuh balik
 * ke kamus `id` untuk kunci yang belum diterjemahkan (P7).
 */
export const en = {
  'app.name': 'Resume Studio',
  'app.tagline': 'Structured resume builder',
  'doc.untitled': 'Untitled CV',
  'status.saving': 'Saving…',
} satisfies Partial<Record<TranslationKey, string>>
