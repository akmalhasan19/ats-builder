import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Check } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/eyebrow'
import { Switch } from '@/components/ui/switch'
import { A4_PX } from '@/lib/units'
import { t, type TranslationKey } from '@/lib/i18n'
import { useDocStore } from '@/store/docStore'
import type { TemplateId } from '@/types/resume'
import {
  ACCENT_HEX,
  getSpec,
  TEMPLATE_FONT_LABELS,
  type TemplateSpec,
} from '@/features/templates/specs'
import { applyTemplate, TEMPLATE_IDS, templateLabelKey } from '@/app/shell/templateList'

const TemplateThumbSheet = lazy(() =>
  import('@/features/templates/screen/TemplateThumbSheet').then((m) => ({
    default: m.TemplateThumbSheet,
  })),
)

// T6.4 — kartu galeri memakai render nyata skala 0.24 (§5.8), detail skala 0.6.
const CARD_SCALE = 0.24
const DETAIL_SCALE = 0.6

const transformLabel = (transform: TemplateSpec['headingStyle']['transform']): TranslationKey =>
  transform === 'uppercase'
    ? 'templates.transform.uppercase'
    : transform === 'small-caps'
      ? 'templates.transform.smallCaps'
      : 'templates.transform.none'

const ruleLabel = (kind: TemplateSpec['headingStyle']['rule']['kind']): TranslationKey =>
  kind === 'solid'
    ? 'templates.rule.solid'
    : kind === 'double'
      ? 'templates.rule.double'
      : kind === 'dotted'
        ? 'templates.rule.dotted'
        : 'templates.rule.none'

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-rule flex items-baseline justify-between gap-4 border-t py-1.5">
      <span className="text-hint text-ink-tertiary uppercase">{label}</span>
      <span className="text-data text-ink text-right">{value}</span>
    </div>
  )
}

/** Panel detail: preview besar kiri + data spec mono di kanan (T6.4). */
function TemplateDetail({ templateId }: { templateId: TemplateId }) {
  const spec = getSpec(templateId)
  const activeId = useDocStore((state) => state.doc.templateId)
  const accentHex = useDocStore((state) => state.doc.theme.accentHex)
  const setThemeTokens = useDocStore((state) => state.setThemeTokens)
  const accentOn = templateId === 'ledger' && accentHex !== null
  const isActive = templateId === activeId
  const heading = spec.typeScale.heading

  return (
    <div data-probe="template-detail" className="grid gap-8 lg:grid-cols-[auto_1fr]">
      <div className="bg-workbench rounded-lg p-6">
        <Suspense
          fallback={
            <div
              className="bg-sunken animate-pulse rounded-[1px]"
              style={{ width: A4_PX.w * DETAIL_SCALE, height: A4_PX.h * DETAIL_SCALE }}
            />
          }
        >
          <TemplateThumbSheet templateId={templateId} scale={DETAIL_SCALE} />
        </Suspense>
      </div>

      <div className="min-w-0">
        <h2 className="text-panel-title text-ink">{t(templateLabelKey(templateId))}</h2>
        <p className="text-body text-ink-secondary mt-1">{t(`template.desc.${templateId}`)}</p>

        <div className="mt-4">
          <SpecRow label={t('templates.spec.margin')} value={`${spec.marginMm} mm · A4`} />
          <SpecRow
            label={t('templates.spec.fontName')}
            value={`${TEMPLATE_FONT_LABELS[spec.typeScale.name.font]} ${spec.typeScale.name.sizePt} pt · w${spec.typeScale.name.weight}`}
          />
          <SpecRow
            label={t('templates.spec.fontHeading')}
            value={`${TEMPLATE_FONT_LABELS[heading.font]} ${heading.sizePt} pt · ${heading.trackingEm > 0 ? `+${heading.trackingEm}em · ` : ''}${t(transformLabel(spec.headingStyle.transform))}`}
          />
          <SpecRow
            label={t('templates.spec.rule')}
            value={
              spec.headingStyle.rule.kind === 'none'
                ? t(ruleLabel('none'))
                : `${t(ruleLabel(spec.headingStyle.rule.kind))} ${spec.headingStyle.rule.widthPt} pt`
            }
          />
          <SpecRow
            label={t('templates.spec.fontBody')}
            value={`${TEMPLATE_FONT_LABELS[spec.typeScale.body.font]} ${spec.typeScale.body.sizePt} pt / ${spec.typeScale.body.lineHeight}`}
          />
          <SpecRow
            label={t('templates.spec.fontMeta')}
            value={`${TEMPLATE_FONT_LABELS[spec.typeScale.meta.font]} ${spec.typeScale.meta.sizePt} pt${spec.typeScale.meta.italic ? ` · ${t('templates.spec.italic')}` : ''}`}
          />
          <SpecRow
            label={t('templates.spec.dates')}
            value={t(
              spec.entryLayout.datePosition === 'right'
                ? 'templates.dates.right'
                : 'templates.dates.nextLine',
            )}
          />
          <SpecRow label={t('templates.spec.bullet')} value={spec.bulletGlyph} />
        </div>

        {templateId === 'ledger' ? (
          <div className="border-rule mt-4 border-t pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-label text-ink-secondary">{t('templates.spec.accent')}</p>
                {accentOn ? (
                  <p data-probe="accent-warning" className="text-hint text-signal-warn mt-1">
                    {t('templates.accentWarning')}
                  </p>
                ) : null}
              </div>
              <Switch
                checked={accentOn}
                onCheckedChange={(on) => setThemeTokens({ accentHex: on ? ACCENT_HEX : null })}
                aria-label={t('templates.spec.accent')}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="primary"
            data-probe="use-template"
            onClick={() => applyTemplate(templateId)}
            className="gap-1.5"
          >
            {isActive ? (
              <>
                <Check aria-hidden="true" className="size-4" />
                {t('topbar.templateActive')}
              </>
            ) : (
              t('templates.use')
            )}
          </Button>
          {isActive ? (
            <span className="text-hint text-ink-tertiary">{t('templates.useHint')}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function TemplatesPage() {
  const activeId = useDocStore((state) => state.doc.templateId)
  const [selected, setSelected] = useState<TemplateId>(activeId)

  return (
    <main className="bg-surface min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-[1100px]">
        <Link
          to="/"
          className="text-button text-cyanotype hover:text-cyanotype-active inline-flex items-center gap-1.5"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('templates.backToEditor')}
        </Link>
        <Eyebrow className="mt-8">{t('templates.eyebrow')}</Eyebrow>
        <h1 className="text-ink display-md mt-2">{t('templates.page.title')}</h1>
        <p className="text-body-lg text-ink-secondary mt-2 max-w-[560px]">
          {t('templates.page.subtitle')}
        </p>

        <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {TEMPLATE_IDS.map((id) => {
            const active = id === activeId
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
                data-probe={`template-card-${id}`}
                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 360px' }}
                className={cn(
                  'border-rule bg-raised hover:shadow-raised group flex flex-col gap-2 rounded-lg border p-3 text-left transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] hover:-translate-y-0.5',
                  selected === id && 'ring-cyanotype ring-2',
                )}
              >
                <span className="bg-workbench flex justify-center rounded-sm p-2">
                  <Suspense
                    fallback={
                      <div
                        className="bg-sunken animate-pulse rounded-[1px]"
                        style={{ width: A4_PX.w * CARD_SCALE, height: A4_PX.h * CARD_SCALE }}
                      />
                    }
                  >
                    <TemplateThumbSheet templateId={id} scale={CARD_SCALE} />
                  </Suspense>
                </span>
                <span className="text-button text-ink flex items-center justify-between gap-1">
                  {t(templateLabelKey(id))}
                  {active ? <Check aria-hidden="true" className="text-cyanotype size-4" /> : null}
                </span>
                <span className="text-body text-ink-secondary line-clamp-2">
                  {t(`template.desc.${id}`)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="border-rule mt-10 border-t pt-8">
          <TemplateDetail templateId={selected} />
        </div>
      </div>
    </main>
  )
}

export default TemplatesPage
