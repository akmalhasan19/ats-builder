import { resolveSpec } from '@/features/templates/specs'
import { PdfExportError, buildResumePdf } from '@/features/templates/pdf/ResumePdfLib'
import type { BuildPdfOptions } from '@/features/templates/pdf/ResumePdfLib'
import type { PagePlan } from '@/features/preview/pagination'
import type { ResumeDoc } from '@/types/resume'

export type ResumePdfBlobResult = {
  blob: Blob
  bytes: number
  durationMs: number
  pageCount: number
}

export async function renderResumePdfToBlob(
  doc: ResumeDoc,
  plan: PagePlan,
  options: BuildPdfOptions = {},
): Promise<ResumePdfBlobResult> {
  const startedAt = performance.now()
  const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
  const { bytes, pageCount } = await buildResumePdf(
    doc,
    spec,
    plan,
    async (file) => {
      let response: Response
      try {
        response = await fetch(`/fonts/${file}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new PdfExportError('font', message)
      }
      if (!response.ok) throw new PdfExportError('font', `Font PDF gagal dimuat: ${file}`)
      return new Uint8Array(await response.arrayBuffer())
    },
    options,
  )

  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  return {
    blob,
    bytes: blob.size,
    durationMs: Math.round(performance.now() - startedAt),
    pageCount,
  }
}
