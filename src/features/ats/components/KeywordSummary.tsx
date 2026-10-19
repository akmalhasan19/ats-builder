import { t } from '@/lib/i18n'
import type { KeywordMatch } from '../types'

/**
 * T7.5 — ringkasan kata kunci. Chip yang belum ada bisa diklik untuk langsung
 * ke kolom keahlian, karena di situlah kata itu biasanya ditambahkan.
 */
export type KeywordSummaryProps = {
  keywords: KeywordMatch | null
  onPickMissing: (term: string) => void
}

export function KeywordSummary({ keywords, onPickMissing }: KeywordSummaryProps) {
  if (!keywords) {
    return (
      <p className="text-caption text-ink-secondary border-rule border-b px-4 py-3">
        {t('ats.keywords.empty')}
      </p>
    )
  }

  return (
    <div className="border-rule border-b px-4 py-3" data-probe="ats-keywords">
      <p className="text-data text-ink">
        {t('ats.keywords.summary', {
          matched: keywords.matched.length,
          missing: keywords.missing.length,
        })}
      </p>

      {keywords.matched.length > 0 ? (
        <p className="text-caption text-ink-secondary mt-1.5">{keywords.matched.join(' · ')}</p>
      ) : null}

      {keywords.missing.length > 0 ? (
        <>
          <p className="text-hint text-ink-tertiary mt-2">{t('ats.keywords.missingHint')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {keywords.missing.map((term) => (
              <button
                key={term}
                type="button"
                data-probe="ats-keyword-missing"
                onClick={() => onPickMissing(term)}
                className="bg-cyanotype-wash text-chip-label text-cyanotype hover:bg-cyanotype-wash/70 inline-flex h-6 items-center rounded px-2"
              >
                {term}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
