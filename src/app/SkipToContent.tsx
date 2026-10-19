import { t } from '@/lib/i18n'

export function SkipToContent({ targetId = 'workspace-main' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="bg-raised text-input border-accent-ink focus-visible:outline-accent-ink sr-only rounded-md border px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
    >
      {t('dev.skipToContent')}
    </a>
  )
}
