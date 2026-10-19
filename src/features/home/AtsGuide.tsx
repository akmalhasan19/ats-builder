import { Check, X } from 'lucide-react'
import { Eyebrow } from '@/components/ui/eyebrow'
import { t } from '@/lib/i18n'
import { HOME_GUIDE_RULES } from './content'

const pad2 = (value: number) => String(value).padStart(2, '0')

const DO_KEYS = ['home.guide.do.1', 'home.guide.do.2', 'home.guide.do.3'] as const
const DONT_KEYS = ['home.guide.dont.1', 'home.guide.dont.2', 'home.guide.dont.3'] as const

function DoDontVisual() {
  return (
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
      <div className="bg-raised border-rule rounded-lg border p-4">
        <p className="text-data text-signal-ok mb-3">{t('home.guide.doTitle')}</p>
        <div className="bg-raised border-rule mx-auto w-[150px] rounded-[1px] border p-3 shadow-[var(--shadow-paper)]">
          <div className="bg-ink mx-auto h-3 w-20 rounded-[1px]" />
          <div className="bg-rule mt-2 h-1.5 w-full rounded-[1px]" />
          <div className="bg-rule mt-1.5 h-1.5 w-full rounded-[1px]" />
          <div className="mt-1.5 flex gap-1">
            <span className="bg-highlighter-wash h-3 flex-1 rounded-[1px]" />
            <span className="bg-highlighter-wash h-3 flex-1 rounded-[1px]" />
          </div>
          <div className="bg-rule mt-1.5 h-1.5 w-3/4 rounded-[1px]" />
        </div>
        <ul className="text-caption text-ink-secondary mt-3 space-y-1.5">
          {DO_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-1.5">
              <Check aria-hidden="true" className="text-signal-ok mt-0.5 size-3.5 shrink-0" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-raised border-rule rounded-lg border p-4">
        <p className="text-data text-signal-bad mb-3">{t('home.guide.dontTitle')}</p>
        <div className="bg-raised border-rule mx-auto w-[150px] rounded-[1px] border p-3 opacity-90 shadow-[var(--shadow-paper)]">
          <div className="flex gap-2">
            <div className="border-rule-strong size-8 shrink-0 rounded-full border" />
            <div className="min-w-0 flex-1">
              <div className="bg-ink h-2.5 w-16 rounded-[1px]" />
              <div className="bg-rule mt-1.5 h-1.5 w-full rounded-[1px]" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <div className="bg-rule h-8 rounded-[1px]" />
            <div className="bg-rule h-8 rounded-[1px]" />
          </div>
          <div className="mt-1.5 flex gap-0.5">
            {[0, 1, 2, 3, 4].map((star) => (
              <span key={star} className="bg-warn-wash size-2.5 rounded-full" />
            ))}
          </div>
        </div>
        <ul className="text-caption text-ink-secondary mt-3 space-y-1.5">
          {DONT_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-1.5">
              <X aria-hidden="true" className="text-signal-bad mt-0.5 size-3.5 shrink-0" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function AtsGuide() {
  return (
    <section aria-labelledby="home-guide-title" className="bg-sunken px-6 py-16 md:py-20">
      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Eyebrow>{t('home.section.guide.eyebrow')}</Eyebrow>
          <h2 id="home-guide-title" className="display-md text-ink mt-2">
            {t('home.section.guide.title')}
          </h2>
          <p className="body-lg mt-2">{t('home.section.guide.body')}</p>
          <div className="mt-6 hidden lg:block">
            <DoDontVisual />
          </div>
        </div>
        <ol className="border-rule-strong border-l-2 pl-0">
          {HOME_GUIDE_RULES.map((rule, index) => (
            <li key={rule.titleKey} className="relative flex gap-4 pb-6 pl-6 last:pb-0">
              <span
                aria-hidden="true"
                className="text-data text-machine-text bg-machine absolute top-0.5 -left-[13px] flex size-6 items-center justify-center rounded-full"
              >
                {pad2(index + 1)}
              </span>
              <div>
                <h3 className="text-step-title text-ink">{t(rule.titleKey)}</h3>
                <p className="text-body text-ink-secondary mt-1 max-w-[60ch]">{t(rule.bodyKey)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="lg:hidden">
          <DoDontVisual />
        </div>
      </div>
    </section>
  )
}
