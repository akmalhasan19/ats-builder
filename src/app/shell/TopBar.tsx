import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Menu, RotateCcw, ScanSearch } from 'lucide-react'
import { cn } from 'cn'
import { BrandMark } from '@/app/BrandMark'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { createEmptyDoc, createSampleDoc } from '@/schema/resume'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore } from '@/store/docStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { useOpenAtsDrawer } from '@/features/ats/useAtsCheck'
import { PdfDownloadButton } from '@/features/pdf/PdfDownloadButton'
import { DocumentTitle } from './DocumentTitle'
import { SaveStatusPill } from './SaveStatusPill'
import { TemplateSelect } from './TemplateSelect'
import { applyTemplate, TEMPLATE_IDS, templateLabelKey } from './templateList'

/** T7.6 — titik `--signal-bad` muncul bila ada isu yang wajib diperbaiki. */
function CheckAtsButton() {
  const openAtsDrawer = useOpenAtsDrawer()
  const hasBlocking = useAtsStore((state) =>
    state.report === null ? false : state.report.issues.some((issue) => issue.severity === 'bad'),
  )

  return (
    <Button
      variant="secondary"
      data-probe="check-ats"
      className="relative gap-1.5 px-3"
      onClick={openAtsDrawer}
    >
      <ScanSearch aria-hidden="true" className="size-[15px]" />
      {t('topbar.checkAts')}
      {hasBlocking ? (
        <span
          aria-hidden="true"
          data-probe="check-ats-badge"
          className="bg-signal-bad absolute -top-0.5 -right-0.5 size-1.5 rounded-full"
        />
      ) : null}
    </Button>
  )
}

/** §5.2 — di bawah 768px hanya brand, judul, dan menu; sisanya masuk sheet ini. */
function MobileMenu() {
  const [open, setOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const activeId = useDocStore((state) => state.doc.templateId)
  const resetDoc = useDocStore((state) => state.resetDoc)
  const isGenerating = usePdfExportStore((state) => state.isGenerating)
  const openAtsDrawer = useOpenAtsDrawer()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton label={t('topbar.menu')} size="lg" className="ml-auto">
          <Menu aria-hidden="true" className="size-[18px]" />
        </IconButton>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[360px]">
        <SheetHeader>
          <SheetTitle>{t('topbar.menuTitle')}</SheetTitle>
          <SheetDescription>{t('topbar.menuPending')}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <p className="text-eyebrow">{t('topbar.templateTitle')}</p>
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
                }}
                className={cn(
                  'border-rule bg-raised text-button text-ink flex h-10 items-center justify-between gap-2 rounded-md border px-3 text-left',
                  active && 'border-cyanotype bg-cyanotype-wash text-cyanotype',
                )}
              >
                {t(templateLabelKey(id))}
                {active ? <Check aria-hidden="true" className="size-4" /> : null}
              </button>
            )
          })}
          <Button
            variant="secondary"
            data-probe="check-ats-mobile"
            className="mt-2 justify-start gap-2"
            onClick={() => {
              openAtsDrawer()
              setOpen(false)
            }}
          >
            <ScanSearch aria-hidden="true" className="size-[15px]" />
            {t('topbar.checkAts')}
          </Button>

          <Button
            variant="ghost"
            disabled={isGenerating}
            onClick={() => setResetDialogOpen(true)}
            className="text-signal-bad hover:bg-bad-wash hover:text-signal-bad mt-4 justify-start gap-2"
          >
            <RotateCcw aria-hidden="true" className="size-[15px]" />
            {t('menu.resetDoc')}
          </Button>
        </div>

        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t('menu.resetDocTitle')}</DialogTitle>
              <DialogDescription>{t('menu.resetDocBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                onClick={() => {
                  resetDoc(createSampleDoc())
                  toast(t('firstRun.sampleToast'))
                  setResetDialogOpen(false)
                  setOpen(false)
                }}
              >
                {t('menu.resetToSample')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetDoc(createEmptyDoc())
                  toast(t('firstRun.emptyToast'))
                  setResetDialogOpen(false)
                  setOpen(false)
                }}
              >
                {t('menu.resetToEmpty')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}

export function TopBar() {
  return (
    <header className="border-rule bg-raised sticky top-0 z-30 flex h-[52px] items-center gap-2 border-b px-3 md:h-14 md:gap-3 md:px-4">
      <Link
        to="/"
        aria-label={t('topbar.brandHome')}
        className="hover:opacity-85 flex shrink-0 items-center gap-2"
      >
        <BrandMark size={20} className="md:hidden" />
        <BrandMark className="hidden md:inline-flex" />
        <span className="text-brand hidden xl:inline">{t('app.name')}</span>
      </Link>

      <span aria-hidden="true" className="bg-rule hidden h-6 w-px xl:block" />

      <div className="flex min-w-0 flex-1 items-center md:max-w-[240px] md:flex-none">
        <DocumentTitle />
      </div>

      <SaveStatusPill className="hidden lg:flex" />

      <div className="ml-auto flex items-center gap-2">
        <TemplateSelect className="hidden lg:inline-flex" />
        <span className="hidden lg:inline-flex">
          <CheckAtsButton />
        </span>
        <span className="hidden md:inline-flex">
          <PdfDownloadButton className="gap-1.5 px-3.5" />
        </span>
      </div>

      <div className="lg:hidden">
        <MobileMenu />
      </div>
    </header>
  )
}
