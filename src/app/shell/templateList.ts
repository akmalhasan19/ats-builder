import type { TranslationKey } from '@/lib/i18n'
import type { TemplateId } from '@/types/resume'

export const TEMPLATE_IDS: TemplateId[] = [
  'classic-ats',
  'ledger',
  'executive',
  'minimal',
  'technician',
]

export const templateLabelKey = (id: TemplateId): TranslationKey => `template.${id}`
