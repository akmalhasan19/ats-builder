import { Link } from 'react-router'
import { BrandMark } from '@/app/BrandMark'
import { t } from '@/lib/i18n'
import { TEMPLATE_IDS, templateLabelKey } from '@/app/shell/templateList'

/**
 * §5.8 — footer 4 kolom (Produk · Template · Sumber daya · Legal) + baris
 * bawah: BrandMark & mono di kiri, pernyataan privasi satu baris di kanan.
 */
export function SiteFooter() {
  return (
    <footer className="bg-sunken border-rule border-t px-6 py-12">
      <div className="mx-auto grid max-w-[1100px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-label={t('home.footer.product')}>
          <p className="text-eyebrow text-ink-tertiary">{t('home.footer.product')}</p>
          <ul className="text-body mt-3 space-y-2">
            <li>
              <Link to="/templates" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.templates')}
              </Link>
            </li>
            <li>
              <a href="#home-templates" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.backToEditor')}
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label={t('home.footer.templates')}>
          <p className="text-eyebrow text-ink-tertiary">{t('home.footer.templates')}</p>
          <ul className="text-body mt-3 space-y-2">
            {TEMPLATE_IDS.map((id) => (
              <li key={id}>
                <Link to="/templates" className="text-ink-secondary hover:text-accent-ink">
                  {t(templateLabelKey(id))}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label={t('home.footer.resources')}>
          <p className="text-eyebrow text-ink-tertiary">{t('home.footer.resources')}</p>
          <ul className="text-body mt-3 space-y-2">
            <li>
              <a href="#home-guide" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.guide')}
              </a>
            </li>
            <li>
              <a href="#home-steps" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.howTo')}
              </a>
            </li>
            <li>
              <a href="#home-faq" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.faqShort')}
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label={t('home.footer.legal')}>
          <p className="text-eyebrow text-ink-tertiary">{t('home.footer.legal')}</p>
          <ul className="text-body mt-3 space-y-2">
            <li>
              <Link to="/privacy" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.privacy')}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="text-ink-secondary hover:text-accent-ink">
                {t('home.footer.terms')}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-rule mx-auto mt-10 flex max-w-[1100px] flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-data text-ink-tertiary flex items-center gap-2">
          <BrandMark />
          {t('home.footer.rights')}
        </p>
        <p className="text-body text-ink-secondary max-w-[62ch]">{t('home.footer.privacyLine')}</p>
      </div>
    </footer>
  )
}
