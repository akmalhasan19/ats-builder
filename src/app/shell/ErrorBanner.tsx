import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveNow } from '@/features/persistence/autosave'
import { t } from '@/lib/i18n'
import { useErrorStore } from '@/store/errorStore'
import { useSyncStore } from '@/store/syncStore'

/**
 * T9.6 — tiga keadaan penyimpanan/galat yang harus dijelaskan tanpa menahan
 * pekerjaan pengguna: galat runtime, kuota IndexedDB penuh, dan mode memori
 * (IndexedDB ditolak).
 */
export function ErrorBanner() {
  const banner = useErrorStore((state) => state.banner)
  const dismissError = useErrorStore((state) => state.dismissError)
  const storageMode = useSyncStore((state) => state.storageMode)

  if (banner === null && storageMode !== 'memory') return null

  const message =
    banner === 'quota'
      ? t('error.banner.quota')
      : banner === 'runtime'
        ? t('error.banner.runtime')
        : t('persist.banner.memory')

  return (
    <div
      role="status"
      aria-live="polite"
      data-probe="error-banner"
      className="border-rule bg-surface flex items-center gap-2 border-b px-4 py-2"
    >
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-signal-warn" />
      <p className="text-hint text-ink-secondary flex-1 font-mono">{message}</p>
      {banner === 'quota' ? (
        <Button type="button" variant="secondary" size="sm" onClick={saveNow}>
          {t('topbar.retrySave')}
        </Button>
      ) : null}
      {banner === 'runtime' ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => window.location.reload()}
        >
          {t('error.reload')}
        </Button>
      ) : null}
      {banner === null ? null : (
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={dismissError}
          className="text-ink-tertiary hover:text-ink flex size-7 shrink-0 items-center justify-center rounded"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
