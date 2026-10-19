import type { TranslationKey } from './id'

/**
 * Stub Bahasa Inggris. Terisi penuh di Fase 11 (T11.i18n); `t()` jatuh balik
 * ke kamus `id` untuk kunci yang belum diterjemahkan (P7).
 */
export const en = {
  'app.name': 'Vetra',
  'app.tagline': 'Structured resume builder',
  'doc.untitled': 'Untitled CV',
  'status.saving': 'Saving…',

  'theme.open': 'Colour theme',
  'theme.title': 'Colour theme',
  'theme.description': 'Changes the app appearance only. Resume content and PDF stay the same.',
  'theme.vetra': 'Vetra',
  'theme.cobalt': 'Cobalt',
  'theme.emerald': 'Emerald',
  'theme.violet': 'Violet',
  'theme.rose': 'Rose',
  'theme.graphite': 'Graphite',
} satisfies Partial<Record<TranslationKey, string>>
