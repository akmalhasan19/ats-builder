import { AlertOctagon } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

/** §T2.2 — kegagalan render tidak boleh berujung layar putih. */
export function ErrorScreen() {
  return (
    <main
      role="alert"
      className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span className="bg-bad-wash text-signal-bad flex size-12 items-center justify-center rounded-full">
        <AlertOctagon aria-hidden="true" className="size-7" />
      </span>
      <h1 className="text-page-title">{t('error.title')}</h1>
      <p className="text-body max-w-[44ch]">{t('error.body')}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => window.location.reload()}>{t('error.reload')}</Button>
        <Button variant="secondary" asChild>
          <Link to="/">{t('error.backToEditor')}</Link>
        </Button>
      </div>
    </main>
  )
}
