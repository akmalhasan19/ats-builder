import { cn } from 'cn'
import { saveNow } from '@/features/persistence/autosave'
import { t, type TranslationKey } from '@/lib/i18n'
import { useSyncStore, type SaveStatus } from '@/store/syncStore'

const STATUS_LABEL: Record<SaveStatus, TranslationKey> = {
  'saved-local': 'status.savedLocal',
  saving: 'status.saving',
  'saved-cloud': 'status.savedCloud',
  offline: 'status.offline',
  error: 'status.error',
}

const STATUS_DOT: Record<SaveStatus, string> = {
  'saved-local': 'bg-ink-tertiary',
  saving: 'bg-cyanotype animate-dot-pulse',
  'saved-cloud': 'bg-signal-ok',
  offline: 'bg-signal-warn',
  error: 'bg-signal-bad',
}

export type SaveStatusPillProps = {
  className?: string
}

/** §5.2 — teksnya sendiri yang memberi arti; titik hanya penguat. */
export function SaveStatusPill({ className }: SaveStatusPillProps) {
  const status = useSyncStore((state) => state.status)
  const label = t(STATUS_LABEL[status])

  const content = (
    <>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', STATUS_DOT[status])} />
      <span className="uppercase">{label}</span>
    </>
  )

  const shared = cn(
    'border-rule bg-surface text-hint text-ink-secondary flex h-6 items-center gap-1.5 rounded-full border px-2 tracking-[0.05em]',
    className,
  )

  return (
    <span role="status" aria-live="polite" aria-label={t('topbar.saveStatus')}>
      {status === 'error' ? (
        <button
          type="button"
          onClick={saveNow}
          title={t('topbar.retrySave')}
          className={cn(shared, 'hover:border-rule-strong hover:text-ink')}
        >
          {content}
        </button>
      ) : (
        <span className={shared}>{content}</span>
      )}
    </span>
  )
}
