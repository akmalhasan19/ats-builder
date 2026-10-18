import { t, type TranslationKey } from '@/lib/i18n'
import type { ReactNode } from 'react'

export function Readout({ labelKey, children }: { labelKey: TranslationKey; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-rule bg-raised px-3 py-2">
      <dt className="text-eyebrow">{t(labelKey)}</dt>
      <dd className="text-data mt-1 text-ink">{children}</dd>
    </div>
  )
}
