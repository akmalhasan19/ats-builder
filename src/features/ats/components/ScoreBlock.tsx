import { cn } from 'cn'
import { t } from '@/lib/i18n'
import { TICK_COUNT, countBySeverity, tickColors } from '../scoring'
import type { AtsReport, AtsSeverity } from '../types'

/**
 * §5.6 — angka Archivo Expanded 56px + bar 20 tick tersegmen (bukan gauge
 * melingkar). Disclaimer permanen tidak pernah disembunyikan oleh state apa pun
 * (P5), termasuk saat skor tinggi atau saat dokumen kosong.
 */

const TICK_COLOR: Record<AtsSeverity, string> = {
  bad: 'bg-signal-bad',
  warn: 'bg-signal-warn',
  info: 'bg-signal-warn',
  ok: 'bg-signal-ok',
}

const BAND_TEXT: Record<AtsReport['band']['colorKey'], string> = {
  'signal-bad': 'text-signal-bad',
  'signal-warn': 'text-signal-warn',
  accent: 'text-accent-ink',
  'signal-ok': 'text-signal-ok',
}

export type ScoreBlockProps = {
  report: AtsReport
  templateLabel: string
  checkedTime: string
}

export function ScoreBlock({ report, templateLabel, checkedTime }: ScoreBlockProps) {
  const buckets = countBySeverity(report.issues)
  const ticks = tickColors(buckets)

  return (
    <div data-probe="ats-score" className="border-rule border-b px-4 py-4">
      <div className="flex items-start gap-4">
        <div>
          <div className="text-score" data-probe="ats-score-value">
            {report.score}
          </div>
          <div className="text-eyebrow mt-1">{t('ats.score.label')}</div>
        </div>

        <div
          className="flex flex-1 items-end gap-0.5 pt-2"
          aria-hidden="true"
          data-probe="ats-score-ticks"
        >
          {Array.from({ length: TICK_COUNT }, (_, index) => (
            <span
              key={index}
              className={cn(
                'h-5 w-1 rounded-sm',
                ticks[index] === undefined ? 'bg-rule' : TICK_COLOR[ticks[index]!],
              )}
            />
          ))}
        </div>
      </div>

      <p
        className={cn('text-button-strong mt-3', BAND_TEXT[report.band.colorKey])}
        data-probe="ats-score-band"
      >
        {t(report.band.labelId)}
      </p>

      <p className="text-hint text-ink-tertiary mt-2">
        {t('ats.meta.checked', { time: checkedTime })} ·{' '}
        {t('ats.meta.template', { template: templateLabel })}
      </p>
    </div>
  )
}
