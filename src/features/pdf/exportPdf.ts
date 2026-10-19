import type { TranslationKey } from '@/lib/i18n'
import { slugify } from '@/lib/text'
import type { PagePlan } from '@/features/preview/pagination'
import type { ResumeDoc } from '@/types/resume'

export type ExportPdfResult = {
  blob: Blob
  filename: string
  bytes: number
  durationMs: number
  pageCount: number
}

export function pdfFilename(doc: ResumeDoc): string {
  const profile = doc.sections.find((section) => section.kind === 'profile')
  const fullName = profile?.kind === 'profile' ? profile.data.fullName : ''
  return `${slugify(fullName || doc.title)}-${doc.templateId}.pdf`
}

export async function exportPdf(
  doc: ResumeDoc,
  plan: PagePlan,
  options: { keywords?: readonly string[] } = {},
): Promise<ExportPdfResult> {
  const { renderResumePdfToBlob } = await import('./renderResumePdf')
  const result = await renderResumePdfToBlob(doc, plan, options)
  return { ...result, filename: pdfFilename(doc) }
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  let url: string
  try {
    url = URL.createObjectURL(blob)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw Object.assign(new Error(message), { code: 'blob' })
  }
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.hidden = true
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function openPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function pdfErrorKey(error: unknown): TranslationKey {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  if (code === 'font') return 'pdf.error.font'
  if (code === 'content') return 'pdf.error.content'
  if (code === 'blob') return 'pdf.error.blob'
  return 'pdf.error.failed'
}
