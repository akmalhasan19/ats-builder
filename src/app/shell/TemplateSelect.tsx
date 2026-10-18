import { lazy, Suspense, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocStore } from '@/store/docStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { A4_PX } from '@/lib/units'
import { t } from '@/lib/i18n'
import type { TemplateId } from '@/types/resume'
import { applyTemplate, TEMPLATE_IDS, templateLabelKey } from './templateList'

const TemplateThumbSheet = lazy(() =>
  import('@/features/templates/screen/TemplateThumbSheet').then((m) => ({
    default: m.TemplateThumbSheet,
  })),
)

// §5.2 — thumbnail trigger memuat render mini template aktif pada lebar 14px.
const TRIGGER_THUMB_SCALE = 14 / A4_PX.w
// T6.4 — thumbnail popover = render nyata diskalakan 0.16.
const CARD_THUMB_SCALE = 0.16

function ThumbSkeleton({ scale, className }: { scale: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('border-rule bg-sunken animate-pulse rounded-[1px] border', className)}
      style={{ width: A4_PX.w * scale, height: A4_PX.h * scale }}
    />
  )
}

/** Thumbnail render-nyata dalam Suspense — skeleton tampil saat chunk thumb dimuat. */
function TemplateThumb({ templateId, scale }: { templateId: TemplateId; scale: number }) {
  return (
    <Suspense fallback={<ThumbSkeleton scale={scale} />}>
      <TemplateThumbSheet templateId={templateId} scale={scale} />
    </Suspense>
  )
}

export type TemplateSelectProps = {
  className?: string
}

/** §5.2 — popover grid; memilih template tidak menyentuh data dokumen. */
export function TemplateSelect({ className }: TemplateSelectProps) {
  const [open, setOpen] = useState(false)
  const activeId = useDocStore((state) => state.doc.templateId)
  // T5.2 — mengganti template di tengah proses ekspor akan membuat PDF tidak
  // cocok dengan rencana halaman yang sedang dipakai.
  const isGenerating = usePdfExportStore((state) => state.isGenerating)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-probe="template-trigger"
          variant="ghost"
          disabled={isGenerating}
          className={cn(
            'border-rule bg-raised text-ink hover:border-rule-strong hover:bg-hover gap-1.5 border px-2.5',
            className,
          )}
          aria-label={t('topbar.templateTitle')}
        >
          <TemplateThumb templateId={activeId} scale={TRIGGER_THUMB_SCALE} />
          <span className="text-button">{t(templateLabelKey(activeId))}</span>
          <ChevronDown aria-hidden="true" className="text-ink-tertiary size-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[340px] p-2">
        <p className="text-eyebrow px-1 pt-1 pb-2">{t('topbar.templateTitle')}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {TEMPLATE_IDS.map((id) => {
            const active = id === activeId
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                disabled={isGenerating}
                onClick={() => {
                  applyTemplate(id)
                  setOpen(false)
                }}
                className={cn(
                  'group border-rule bg-raised hover:border-rule-strong hover:shadow-raised flex flex-col items-stretch gap-1.5 rounded-lg border p-2 text-left transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] hover:-translate-y-0.5',
                  active && 'ring-cyanotype bg-cyanotype-wash ring-2',
                )}
              >
                <span className="bg-workbench flex justify-center rounded-sm p-1">
                  <TemplateThumb templateId={id} scale={CARD_THUMB_SCALE} />
                </span>
                <span className="text-button text-ink flex w-full items-center justify-between gap-1">
                  {t(templateLabelKey(id))}
                  {active ? <Check aria-hidden="true" className="text-cyanotype size-3.5" /> : null}
                </span>
                <span className="text-body text-ink-secondary line-clamp-2">
                  {t(`template.desc.${id}`)}
                </span>
                {active ? (
                  <span className="text-hint text-cyanotype uppercase">
                    {t('topbar.templateActive')}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
