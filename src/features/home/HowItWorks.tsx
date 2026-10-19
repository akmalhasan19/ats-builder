import { Suspense, lazy } from 'react'
import type { TranslationKey } from '@/lib/i18n'
import { Eyebrow } from '@/components/ui/eyebrow'
import { t } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'

const StepThumbSheet = lazy(() =>
  import('@/features/templates/screen/TemplateThumbSheet').then((m) => ({
    default: m.TemplateThumbSheet,
  })),
)

const STEPS: { titleKey: TranslationKey; bodyKey: TranslationKey }[] = [
  { titleKey: 'home.step.1.title', bodyKey: 'home.step.1.body' },
  { titleKey: 'home.step.2.title', bodyKey: 'home.step.2.body' },
  { titleKey: 'home.step.3.title', bodyKey: 'home.step.3.body' },
]

// §5.8 Tiga Langkah — mini-render nyata template aktif di kanan (≥1024).
const STEP_THUMB_SCALE = 0.34

/** §5.8 — stepper vertikal dengan rule 1px penghubung + lingkaran 64px. */
export function HowItWorks() {
  const templateId = useDocStore((state) => state.doc.templateId)

  return (
    <section aria-labelledby="home-steps-title" className="bg-surface px-6 py-16 md:py-20">
      <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <Eyebrow>{t('home.section.steps.eyebrow')}</Eyebrow>
          <h2 id="home-steps-title" className="display-md mt-2">
            {t('home.section.steps.title')}
          </h2>
          <ol className="mt-8">
            {STEPS.map((step, index) => (
              <li key={step.titleKey} className="relative flex gap-5 pb-8 last:pb-0">
                {index < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="bg-rule-strong absolute top-16 bottom-0 left-8 w-px"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className="bg-accent-wash text-step-number flex size-16 shrink-0 items-center justify-center rounded-full"
                >
                  {index + 1}
                </span>
                <div className="pt-3">
                  <h3 className="text-step-title">{t(step.titleKey)}</h3>
                  <p className="text-body mt-1 max-w-[52ch]">{t(step.bodyKey)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div aria-hidden="true" className="hidden lg:block">
          <div className="bg-workbench rounded-lg p-6">
            <Suspense fallback={null}>
              <StepThumbSheet templateId={templateId} scale={STEP_THUMB_SCALE} />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  )
}
