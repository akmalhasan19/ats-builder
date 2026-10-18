import { cn } from 'cn'
import { PanelHeader } from '@/components/ui/panel-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { sectionRegistry } from '@/features/sections/registry'
import { useDocStore } from '@/store/docStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'

/**
 * §5.3 — kerangka rail. Isi penuh (checkbox visibilitas, completeness dots,
 * reorder) menyusul di Fase 3; di sini hanya navigasi antarbagian.
 */
export function Rail() {
  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)
  const setActiveSection = useDocStore((state) => state.setActiveSection)
  const panelMode = useUiStore((state) => state.panelMode)
  const iconOnly = panelMode === 'icon-rail'

  const visibleCount = sections.filter((section) => section.visible).length

  return (
    <aside
      aria-label={t('rail.heading')}
      className="border-rule bg-sunken hidden flex-col border-r lg:flex lg:w-14 xl:w-[248px]"
    >
      <PanelHeader
        title={t('rail.heading')}
        meta={`${visibleCount}/${sections.length}`}
        className="hidden px-2.5 pt-3 pb-2 xl:flex"
      />

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-1 px-1.5 py-2">
          {sections.map((section) => {
            const entry = sectionRegistry[section.kind]
            const Icon = entry.icon
            const active = section.id === activeSectionId
            const label = t(entry.labelId)
            const button = (
              <button
                key={section.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  'text-rail-label hover:bg-hover flex h-10 items-center gap-2 rounded-md px-2 text-left transition-colors duration-[var(--dur-fast)]',
                  !section.visible && 'opacity-55',
                  active
                    ? 'bg-cyanotype-wash text-ink font-semibold shadow-[var(--shadow-active-bar)]'
                    : 'text-ink',
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'size-[15px] shrink-0',
                    active ? 'text-cyanotype' : 'text-ink-tertiary',
                  )}
                />
                <span className="truncate sr-only xl:not-sr-only">{label}</span>
              </button>
            )

            return iconOnly ? (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              button
            )
          })}
        </nav>
      </ScrollArea>
    </aside>
  )
}
