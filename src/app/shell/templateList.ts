import { toast } from 'sonner'
import type { TranslationKey } from '@/lib/i18n'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import type { TemplateId } from '@/types/resume'

export const TEMPLATE_IDS: TemplateId[] = [
  'classic-ats',
  'ledger',
  'executive',
  'minimal',
  'technician',
]

export const templateLabelKey = (id: TemplateId): TranslationKey => `template.${id}`

/**
 * Satu pintu ganti template (T6.4): hanya `doc.templateId` yang berubah —
 * sections/settings/theme tersentuh — lalu toast konfirmasi.
 */
export function applyTemplate(templateId: TemplateId): void {
  useDocStore.getState().setTemplate(templateId)
  toast(t('template.appliedToast', { name: t(templateLabelKey(templateId)) }))
}
