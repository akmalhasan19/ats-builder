import { Link } from 'react-router'
import { t } from '@/lib/i18n'
import { devRoutesEnabled } from './env'

const DEV_LINKS = [
  { to: '/dev/tokens', labelKey: 'dev.nav.tokens' },
  { to: '/dev/pdf', labelKey: 'dev.nav.pdf' },
  { to: '/dev/preview', labelKey: 'dev.nav.preview' },
  { to: '/dev/persist', labelKey: 'dev.nav.persist' },
] as const

export function RootPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="flex h-14 items-center gap-3 border-b border-rule bg-raised px-4">
        <span className="text-brand">{t('app.name')}</span>
        <span className="text-data text-ink-tertiary">{t('app.tagline')}</span>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-6 py-16">
        <h1 className="display-md">{t('home.title')}</h1>
        <p className="body-lg mt-3">{t('home.body')}</p>

        {devRoutesEnabled ? (
          <section className="mt-10 border-t border-rule pt-6">
            <h2 className="text-eyebrow">{t('home.devHeading')}</h2>
            <p className="text-body mt-1">{t('home.devNote')}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {DEV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-input inline-flex h-9 items-center gap-2 rounded-md border border-rule bg-raised px-3 hover:border-cyanotype hover:text-cyanotype"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  )
}
