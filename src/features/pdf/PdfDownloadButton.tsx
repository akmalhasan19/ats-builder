import { useEffect, useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { scrollToFirstInvalidField } from '@/features/editor/scrollToFirstInvalidField'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { resolveSpec } from '@/features/templates/specs'
import { useAtsStore } from '@/store/atsStore'
import { useUiStore } from '@/store/uiStore'
import { t } from '@/lib/i18n'
import { resumeDocSchema } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { useSettledHeights } from '@/store/previewStore'
import { downloadPdfBlob, exportPdf, openPdfBlob, pdfErrorKey, queueExport } from './exportPdf'

export type PdfDownloadButtonProps = {
  className?: string
}

export function PdfDownloadButton({ className }: PdfDownloadButtonProps) {
  const heights = useSettledHeights()
  const isGenerating = usePdfExportStore((state) => state.isGenerating)
  const setGenerating = usePdfExportStore((state) => state.setGenerating)
  const keywords = useAtsStore((state) => state.keywords)
  const includeMarksInPdf = useUiStore((state) => state.includeMarksInPdf)
  const [slow, setSlow] = useState(false)
  const slowTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (slowTimer.current !== null) window.clearTimeout(slowTimer.current)
    },
    [],
  )

  async function handleDownload() {
    const currentDoc = useDocStore.getState().doc
    if (!resumeDocSchema.safeParse(currentDoc).success) {
      scrollToFirstInvalidField()
      toast(t('pdf.error.invalid'))
      return
    }

    const spec = resolveSpec(currentDoc.templateId, currentDoc.theme, currentDoc.settings.page)
    const currentPlan = createPagePlan(currentDoc, spec, heights)

    setGenerating(true)
    setSlow(false)
    slowTimer.current = window.setTimeout(() => setSlow(true), 1200)
    try {
      const result = await queueExport(() =>
        exportPdf(currentDoc, currentPlan, {
          keywords: includeMarksInPdf ? keywords : [],
        }),
      )
      downloadPdfBlob(result.blob, result.filename)
      toast(t('pdf.success.downloaded'), {
        // Nama berkas ikut ditampilkan supaya hubungan antara judul di top bar
        // dan nama berkas hasil unduhan terlihat jelas.
        description: result.filename,
        action: {
          label: t('pdf.action.open'),
          onClick: () => openPdfBlob(result.blob),
        },
      })
    } catch (error) {
      toast(t(pdfErrorKey(error)))
    } finally {
      if (slowTimer.current !== null) window.clearTimeout(slowTimer.current)
      slowTimer.current = null
      setSlow(false)
      setGenerating(false)
    }
  }

  return (
    <Button
      data-probe="download-pdf"
      className={className}
      disabled={isGenerating}
      onClick={() => void handleDownload()}
      aria-describedby={slow ? 'pdf-export-progress' : undefined}
    >
      {isGenerating ? (
        <Loader2 aria-hidden="true" className="size-[15px] animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-[15px]" />
      )}
      {isGenerating ? t('pdf.state.generating') : t('topbar.download')}
      {slow ? (
        <span id="pdf-export-progress" className="sr-only" role="status" aria-live="polite">
          {t('pdf.state.slow')}
        </span>
      ) : null}
    </Button>
  )
}
