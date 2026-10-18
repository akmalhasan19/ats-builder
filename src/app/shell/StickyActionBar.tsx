import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, List, Plus } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { getSectionCompleteness, sectionRegistry } from '@/features/sections/registry'
import { SECTION_ORDER } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { PdfDownloadButton } from '@/features/pdf/PdfDownloadButton'

function CompletenessDots({ dots }: { dots: 0 | 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((step) => {
        const filled = dots >= step
        const isOk = dots === 3
        return (
          <span
            key={step}
            className={cn(
              'size-1 rounded-full transition-colors',
              isOk
                ? 'bg-signal-ok'
                : filled
                  ? 'bg-cyanotype'
                  : 'border-rule-strong border bg-transparent',
            )}
          />
        )
      })}
    </div>
  )
}

/** §5.7 — bar bawah mobile + sheet "Bagian" sebagai pengganti rail. */
export function StickyActionBar() {
  const [open, setOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const sections = useDocStore((state) => state.doc.sections)
  const activeSectionId = useDocStore((state) => state.activeSectionId)
  const setActiveSection = useDocStore((state) => state.setActiveSection)
  const toggleSectionVisible = useDocStore((state) => state.toggleSectionVisible)
  const reorderSection = useDocStore((state) => state.reorderSection)
  const addSection = useDocStore((state) => state.addSection)
  const setActiveTab = useUiStore((state) => state.setActiveTab)
  const isGenerating = usePdfExportStore((state) => state.isGenerating)

  const existingKinds = new Set(sections.map((section) => section.kind))
  const availableCatalogKinds = SECTION_ORDER.filter((kind) => !existingKinds.has(kind))

  return (
    <>
      <div className="border-rule bg-raised fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-center gap-2 border-t px-3 pb-[env(safe-area-inset-bottom)] md:hidden">
        <Button
          variant="ghost"
          disabled={isGenerating}
          className="h-11 gap-1.5 px-3"
          onClick={() => setOpen(true)}
        >
          <List aria-hidden="true" className="size-4" />
          {t('mobile.sections')}
        </Button>
        <PdfDownloadButton className="text-button-lg h-11 flex-1" />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex h-[80dvh] flex-col p-0">
          <SheetHeader className="border-rule border-b p-4">
            <SheetTitle>{t('mobile.sectionsTitle')}</SheetTitle>
            <SheetDescription>{t('rail.visibleOf')}</SheetDescription>
          </SheetHeader>

          <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
            {sections.map((section, index) => {
              const entry = sectionRegistry[section.kind]
              const Icon = entry.icon
              const active = section.id === activeSectionId
              const label = t(entry.labelId)
              const completeness = getSectionCompleteness(section)

              return (
                <div
                  key={section.id}
                  className={cn(
                    'border-rule bg-raised flex h-12 items-center gap-2 rounded-md border px-3',
                    active && 'border-cyanotype bg-cyanotype-wash',
                  )}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={section.visible}
                    aria-label={`${t('rail.toggleVisibility')}: ${label}`}
                    onClick={() => toggleSectionVisible(section.id)}
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                      section.visible
                        ? 'border-cyanotype bg-cyanotype text-raised'
                        : 'border-rule-strong bg-raised text-transparent',
                    )}
                  >
                    <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => {
                      setActiveSection(section.id)
                      setActiveTab('form')
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 truncate py-2 text-left"
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'size-4 shrink-0',
                        active ? 'text-cyanotype' : 'text-ink-tertiary',
                      )}
                    />
                    <span
                      className={cn(
                        'text-rail-label truncate',
                        !section.visible && 'text-ink-tertiary opacity-55',
                      )}
                    >
                      {label}
                    </span>
                  </button>

                  <CompletenessDots dots={completeness.dots} />

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`${t('rail.moveUp')}: ${label}`}
                      onClick={() => reorderSection(index, index - 1)}
                      className="text-ink-tertiary hover:text-ink active:bg-hover flex size-8 items-center justify-center rounded disabled:opacity-20"
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sections.length - 1}
                      aria-label={`${t('rail.moveDown')}: ${label}`}
                      onClick={() => reorderSection(index, index + 1)}
                      className="text-ink-tertiary hover:text-ink active:bg-hover flex size-8 items-center justify-center rounded disabled:opacity-20"
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="border-rule border-t p-3">
            <button
              type="button"
              onClick={() => setCatalogOpen(true)}
              className="border-rule-strong text-button text-ink-secondary hover:border-cyanotype hover:text-cyanotype hover:bg-cyanotype-wash flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed transition-colors"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span>{t('rail.addSection')}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Catalog Dialog (Mobile) */}
      <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('rail.catalogTitle')}</DialogTitle>
            <DialogDescription>{t('rail.catalogDesc')}</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
            {availableCatalogKinds.length === 0 ? (
              <p className="text-body text-ink-secondary py-4 text-center">
                {t('rail.catalogEmpty')}
              </p>
            ) : (
              availableCatalogKinds.map((kind) => {
                const entry = sectionRegistry[kind]
                const Icon = entry.icon
                return (
                  <div
                    key={kind}
                    className="border-rule bg-raised flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="bg-cyanotype-wash text-cyanotype mt-0.5 flex size-8 shrink-0 items-center justify-center rounded">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-rail-label text-ink font-semibold">
                          {t(entry.labelId)}
                        </h2>
                        <p className="text-caption text-ink-secondary">{t(entry.descriptionId)}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        addSection(kind)
                        setActiveTab('form')
                        setCatalogOpen(false)
                        setOpen(false)
                      }}
                    >
                      {t('rail.add')}
                    </Button>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
