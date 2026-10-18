import { cn } from 'cn'
import { Eyebrow } from '@/components/ui/eyebrow'
import { EmptyState } from '@/components/ui/empty-state'
import { LayoutList } from 'lucide-react'
import { sectionRegistry } from '@/features/sections/registry'
import { useDocStore } from '@/store/docStore'
import { t } from '@/lib/i18n'

const pad2 = (value: number) => String(value).padStart(2, '0')

/** §5.4 — kerangka pane tengah; editor per bagian menyusul di Fase 3. */
export function FormPane({ className }: { className?: string }) {
  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)

  const index = sections.findIndex((section) => section.id === activeSectionId)
  const active = index >= 0 ? sections[index] : undefined
  const entry = active ? sectionRegistry[active.kind] : undefined

  return (
    <section
      id="pane-form"
      aria-label={t('rail.heading')}
      className={cn('bg-surface min-h-0 overflow-y-auto px-5 py-4', className)}
    >
      {active && entry ? (
        <>
          <Eyebrow>
            {t('workspace.formEyebrow')} {pad2(index + 1)} / {pad2(sections.length)}
          </Eyebrow>
          <h1 className="text-panel-title mt-1">{t(entry.labelId)}</h1>
          <p className="text-body mt-3 max-w-[60ch]">{t('workspace.formPending')}</p>
        </>
      ) : (
        <EmptyState icon={LayoutList} title={t('rail.empty')} body={t('workspace.formPending')} />
      )}
    </section>
  )
}
