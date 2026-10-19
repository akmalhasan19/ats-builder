import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Eyebrow } from '@/components/ui/eyebrow'
import { A4_PX } from '@/lib/units'
import { t } from '@/lib/i18n'
import { applyTemplate, TEMPLATE_IDS, templateLabelKey } from '@/app/shell/templateList'

const HomeTemplateThumb = lazy(() =>
  import('@/features/templates/screen/TemplateThumbSheet').then((m) => ({
    default: m.TemplateThumbSheet,
  })),
)

const CARD_SCALE = 0.24

function TemplateThumb({ templateId }: { templateId: (typeof TEMPLATE_IDS)[number] }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <span ref={ref} aria-hidden="true" className="bg-workbench flex justify-center rounded-sm p-2">
      {visible ? (
        <Suspense
          fallback={
            <div
              className="bg-sunken animate-pulse rounded-[1px]"
              style={{ width: A4_PX.w * CARD_SCALE, height: A4_PX.h * CARD_SCALE }}
            />
          }
        >
          <HomeTemplateThumb templateId={templateId} scale={CARD_SCALE} />
        </Suspense>
      ) : (
        <div
          aria-hidden="true"
          className="bg-sunken rounded-[1px]"
          style={{ width: A4_PX.w * CARD_SCALE, height: A4_PX.h * CARD_SCALE }}
        />
      )}
    </span>
  )
}

function TemplateCard({ templateId }: { templateId: (typeof TEMPLATE_IDS)[number] }) {
  return (
    <button
      type="button"
      onClick={() => {
        applyTemplate(templateId)
        document.getElementById('workspace-main')?.scrollIntoView({ behavior: 'smooth' })
      }}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 360px' }}
      className="border-rule bg-raised hover:shadow-raised group flex flex-col gap-2 rounded-lg border p-3 text-left transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] hover:-translate-y-[3px]"
    >
      <TemplateThumb templateId={templateId} />
      <span className="text-button text-ink flex items-center justify-between gap-1">
        {t(templateLabelKey(templateId))}
        <span className="text-hint text-accent-ink opacity-0 transition-opacity duration-[var(--dur-fast)] group-hover:opacity-100 group-focus-visible:opacity-100">
          {t('home.section.templates.useThis')}
        </span>
      </span>
      <span className="text-body text-ink-secondary line-clamp-2">
        {t(`template.desc.${templateId}`)}
      </span>
    </button>
  )
}

export function TemplateGallery() {
  return (
    <section aria-labelledby="home-templates-title" className="bg-surface px-6 py-16 md:py-20">
      <div className="mx-auto max-w-[1100px]">
        <Eyebrow>{t('home.section.templates.eyebrow')}</Eyebrow>
        <h2 id="home-templates-title" className="display-md text-ink mt-2">
          {t('home.section.templates.title')}
        </h2>
        <p className="body-lg mt-2 max-w-[560px]">{t('home.section.templates.body')}</p>
        <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {TEMPLATE_IDS.map((id) => (
            <TemplateCard key={id} templateId={id} />
          ))}
        </div>
        <Link
          to="/templates"
          className="text-button text-accent-ink hover:text-accent-active mt-6 inline-flex items-center gap-1.5"
        >
          {t('home.section.templates.viewAll')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  )
}
