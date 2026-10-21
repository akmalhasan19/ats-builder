import { useState } from 'react'
import { List } from 'lucide-react'
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
import { sectionRegistry } from '@/features/sections/registry'
import { SECTION_ORDER } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { PdfDownloadButton } from '@/features/pdf/PdfDownloadButton'
import { SectionAddButton, SectionListNav } from './SectionListNav'

/** §5.7 — bar bawah mobile + sheet "Bagian" sebagai pengganti rail. */
export function StickyActionBar() {
  const [open, setOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const sections = useDocStore((state) => state.doc.sections)
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
        {/* h-44 tanpa utility tipe lain: tw-merge menganggap text-button-lg
            dan text-button-primary (varian primary) satu grup font dan
            membuang warna putihnya — kontras 2,38:1 di Lighthouse. */}
        <PdfDownloadButton className="h-11 flex-1" />
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex h-[80dvh] flex-col p-0">
          <SheetHeader className="border-rule border-b p-4">
            <SheetTitle>{t('mobile.sectionsTitle')}</SheetTitle>
            <SheetDescription>{t('rail.visibleOf')}</SheetDescription>
          </SheetHeader>

          {/* FASE 13 (T3.4) — daftarnya pindah ke `SectionListNav` karena menu
              "Bagian" di toolbar kanvas memakai baris yang sama persis. */}
          <SectionListNav
            onSelected={() => setOpen(false)}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          />

          <div className="border-rule border-t p-3">
            <SectionAddButton onClick={() => setCatalogOpen(true)} />
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
                      <div className="bg-accent-wash text-accent-ink mt-0.5 flex size-8 shrink-0 items-center justify-center rounded">
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
