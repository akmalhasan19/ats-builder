import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Eyebrow } from '@/components/ui/eyebrow'
import { t } from '@/lib/i18n'

export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const title = t(page === 'privacy' ? 'legal.privacy.title' : 'legal.terms.title')
  const intro = t(page === 'privacy' ? 'legal.privacy.intro' : 'legal.terms.intro')

  return (
    <main className="bg-surface min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-[760px]">
        <Link
          to="/"
          className="text-button text-cyanotype hover:text-cyanotype-active inline-flex items-center gap-1.5"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('legal.backToEditor')}
        </Link>
        <Eyebrow className="mt-8">{t('app.name')}</Eyebrow>
        <h1 className="text-page-title mt-2">{title}</h1>
        <p className="text-caption text-ink-tertiary mt-1">{t('legal.updated')}</p>
        <p className="body-lg mt-4">{intro}</p>

        {page === 'privacy' ? (
          <>
            <h2 className="text-dialog-title mt-8">{t('legal.privacy.storedTitle')}</h2>
            <ul className="text-body text-ink-secondary mt-2 list-disc space-y-1 pl-5">
              <li>{t('legal.privacy.stored.1')}</li>
              <li>{t('legal.privacy.stored.2')}</li>
              <li>{t('legal.privacy.stored.3')}</li>
            </ul>
            <h2 className="text-dialog-title mt-8">{t('legal.privacy.notCollectedTitle')}</h2>
            <ul className="text-body text-ink-secondary mt-2 list-disc space-y-1 pl-5">
              <li>{t('legal.privacy.notCollected.1')}</li>
              <li>{t('legal.privacy.notCollected.2')}</li>
            </ul>
            <h2 className="text-dialog-title mt-8">{t('legal.privacy.contactTitle')}</h2>
            <p className="text-body text-ink-secondary mt-2">{t('legal.privacy.contactBody')}</p>
          </>
        ) : (
          <>
            <h2 className="text-dialog-title mt-8">{t('legal.terms.useTitle')}</h2>
            <ul className="text-body text-ink-secondary mt-2 list-disc space-y-1 pl-5">
              <li>{t('legal.terms.use.1')}</li>
              <li>{t('legal.terms.use.2')}</li>
            </ul>
            <h2 className="text-dialog-title mt-8">{t('legal.terms.noGuaranteeTitle')}</h2>
            <p className="text-body text-ink-secondary mt-2">{t('legal.terms.noGuaranteeBody')}</p>
            <h2 className="text-dialog-title mt-8">{t('legal.terms.liabilityTitle')}</h2>
            <p className="text-body text-ink-secondary mt-2">{t('legal.terms.liabilityBody')}</p>
          </>
        )}
      </div>
    </main>
  )
}
