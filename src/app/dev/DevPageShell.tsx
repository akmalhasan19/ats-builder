import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { t, type TranslationKey } from '@/lib/i18n'

const NAV: { to: string; labelKey: TranslationKey }[] = [
  { to: '/dev/tokens', labelKey: 'dev.nav.tokens' },
  { to: '/dev/pdf', labelKey: 'dev.nav.pdf' },
  { to: '/dev/preview', labelKey: 'dev.nav.preview' },
]

export type DevPageShellProps = {
  titleKey: TranslationKey
  subtitleKey: TranslationKey
  maxWidthClass?: string
  children: ReactNode
}

export function DevPageShell({
  titleKey,
  subtitleKey,
  maxWidthClass = 'max-w-[1200px]',
  children,
}: DevPageShellProps) {
  return (
    <div className="min-h-dvh bg-surface">
      <a
        href="#dev-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2"
      >
        {t('dev.skipToContent')}
      </a>

      <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule bg-raised px-4 py-2">
        <Link to="/" className="text-brand hover:opacity-85">
          {t('app.name')}
        </Link>
        <span className="text-data rounded-full border border-rule bg-surface px-2 py-0.5 text-ink-tertiary uppercase">
          {t('dev.badge')}
        </span>
        <nav
          aria-label={t('home.devHeading')}
          className="ml-auto flex flex-wrap items-center justify-end gap-1"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-md px-3 py-1.5 text-[13px] font-medium',
                  isActive
                    ? 'bg-cyanotype-wash text-cyanotype'
                    : 'text-ink-secondary hover:bg-sunken hover:text-ink',
                ].join(' ')
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="dev-main" className={`mx-auto w-full ${maxWidthClass} px-6 py-8`}>
        <h1 className="display-md">{t(titleKey)}</h1>
        <p className="text-body mt-2 max-w-[80ch]">{t(subtitleKey)}</p>
        <div className="mt-8">{children}</div>
      </main>
    </div>
  )
}
