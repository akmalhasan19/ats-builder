import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MonthPicker } from './MonthPicker'
import { t } from '@/lib/i18n'

export type DateRangeFieldProps = {
  idPrefix: string
  startDate: string
  endDate: string
  current: boolean
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onCurrentChange: (value: boolean) => void
  startLabel?: string
  endLabel?: string
  currentLabel?: string
  error?: string
}

export function DateRangeField({
  idPrefix,
  startDate,
  endDate,
  current,
  onStartDateChange,
  onEndDateChange,
  onCurrentChange,
  startLabel,
  endLabel,
  currentLabel,
  error,
}: DateRangeFieldProps) {
  const startId = `${idPrefix}-start`
  const endId = `${idPrefix}-end`
  const currentId = `${idPrefix}-current`

  const resolvedStartLabel = startLabel ?? t('experience.startDate')
  const resolvedEndLabel = endLabel ?? t('experience.endDate')
  const resolvedCurrentLabel = currentLabel ?? t('experience.current')

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={startId}>{resolvedStartLabel}</Label>
          <MonthPicker
            id={startId}
            value={startDate}
            onChange={onStartDateChange}
            aria-invalid={Boolean(error)}
          />
        </div>

        <span
          aria-hidden="true"
          className="text-data text-ink-tertiary hidden pb-2 text-center sm:inline-block"
        >
          –
        </span>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={endId}>{resolvedEndLabel}</Label>
            {current ? (
              <span className="text-chip-label bg-accent-wash text-accent-ink rounded px-1.5 py-0.5 font-mono font-medium">
                {t('experience.presentChip')}
              </span>
            ) : null}
          </div>
          <MonthPicker
            id={endId}
            value={current ? '' : endDate}
            onChange={onEndDateChange}
            disabled={current}
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>

      <div className="border-rule bg-raised flex h-10 items-center justify-between rounded-md border px-3">
        <Label htmlFor={currentId} className="cursor-pointer font-normal">
          {resolvedCurrentLabel}
        </Label>
        <Switch id={currentId} checked={current} onCheckedChange={onCurrentChange} />
      </div>

      {error ? (
        <p role="alert" className="text-caption text-signal-bad">
          {error}
        </p>
      ) : null}
    </div>
  )
}
