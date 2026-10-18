import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/eyebrow'
import { t, type TranslationKey } from '@/lib/i18n'

export type PlaceholderPageProps = {
  titleKey: TranslationKey
}

/** T2.2 — rute harus ada dan bisa dicapai; isinya menyusul di fase terkait. */
export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  return (
    <main className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <Eyebrow>{t('app.name')}</Eyebrow>
      <h1 className="text-page-title">{t(titleKey)}</h1>
      <p className="text-body max-w-[44ch]">{t('route.pending')}</p>
      <Button variant="secondary" asChild className="mt-2">
        <Link to="/">{t('error.backToEditor')}</Link>
      </Button>
    </main>
  )
}
