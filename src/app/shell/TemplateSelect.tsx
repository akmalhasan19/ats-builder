import { useState } from 'react'
import { Check, ChevronDown, FileText } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDocStore } from '@/store/docStore'
import { t } from '@/lib/i18n'
import { TEMPLATE_IDS, templateLabelKey } from './templateList'

/** Thumbnail nyata baru ada di Fase 6; sekarang lembar mini sebagai penanda. */
function TemplateThumb() {
  return (
    <span
      aria-hidden="true"
      className="border-rule bg-raised flex h-[18px] w-[14px] shrink-0 flex-col gap-[2px] rounded-[1px] border p-[2px]"
    >
      <span className="bg-rule-strong h-[1px] w-full" />
      <span className="bg-rule-strong h-[1px] w-full" />
      <span className="bg-rule-strong h-[1px] w-2/3" />
    </span>
  )
}

export type TemplateSelectProps = {
  className?: string
}

/** §5.2 — popover grid; memilih template tidak menyentuh data dokumen. */
export function TemplateSelect({ className }: TemplateSelectProps) {
  const [open, setOpen] = useState(false)
  const activeId = useDocStore((state) => state.doc.templateId)
  const setTemplate = useDocStore((state) => state.setTemplate)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-probe="template-trigger"
          variant="ghost"
          className={cn(
            'border-rule bg-raised text-ink hover:border-rule-strong hover:bg-hover gap-1.5 border px-2.5',
            className,
          )}
          aria-label={t('topbar.templateTitle')}
        >
          <TemplateThumb />
          <span className="text-button">{t(templateLabelKey(activeId))}</span>
          <ChevronDown aria-hidden="true" className="text-ink-tertiary size-3.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[320px] p-2">
        <p className="text-eyebrow px-1 pt-1 pb-2">{t('topbar.templateTitle')}</p>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATE_IDS.map((id) => {
            const active = id === activeId
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTemplate(id)
                  setOpen(false)
                }}
                className={cn(
                  'group border-rule bg-raised hover:border-rule-strong hover:shadow-raised flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] hover:-translate-y-0.5',
                  active && 'border-cyanotype bg-cyanotype-wash ring-cyanotype ring-1',
                )}
              >
                <FileText aria-hidden="true" className="text-ink-tertiary size-4" />
                <span className="text-button text-ink flex w-full items-center justify-between gap-1">
                  {t(templateLabelKey(id))}
                  {active ? <Check aria-hidden="true" className="text-cyanotype size-3.5" /> : null}
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
