import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

export function NotFoundPage() {
  return (
    <main className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-page-title">{t('route.notFoundTitle')}</h1>
      <p className="text-body max-w-[44ch]">{t('route.notFoundBody')}</p>
      <Button asChild className="mt-2">
        <Link to="/">{t('error.backToEditor')}</Link>
      </Button>
    </main>
  )
}
