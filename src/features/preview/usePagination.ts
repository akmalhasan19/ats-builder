import { useMemo } from 'react'
import type { ResumeDoc, TemplateId } from '@/types/resume'
import { resolveSpec } from '@/features/templates/specs'
import { useSettledHeights } from '@/store/previewStore'
import { createPagePlan } from './createPagePlan'
import type { PagePlan } from './pagination'

/**
 * Rencana halaman untuk satu dokumen (T4.2). Dipakai renderer layar sekarang dan
 * renderer PDF di Fase 5, supaya pemecahan halaman identik (P4).
 *
 * Rencana ini TANPA blok guide: pemeriksa ATS, ekspor PDF, dan mode form
 * selalu menyangkut isi dokumen, bukan kerangka pemandu.
 */
export function usePagination(doc: ResumeDoc, templateId: TemplateId): PagePlan {
  const heights = useSettledHeights()
  const spec = useMemo(
    () => resolveSpec(templateId, doc.theme, doc.settings.page),
    [templateId, doc.theme, doc.settings.page],
  )

  return useMemo(() => createPagePlan(doc, spec, heights), [doc, spec, heights])
}

export type PreviewPlans = {
  /** Rencana isi dokumen — dipakai ATS, ekspor PDF, dan mode form. */
  content: PagePlan
  /** Rencana dengan blok guide; hanya ada di mode kanvas (C2). */
  canvas: PagePlan | null
}

/**
 * Dua rencana untuk pratinjau (C2). Mode kanvas memakai rencana `canvas`:
 * field kosong tetap punya blok berisi guide, jadi kertas kosong menjadi
 * kerangka CV yang menjelaskan dirinya sendiri (D16). Rencana `content` tetap
 * dihitung supaya pemeriksa ATS menilai dokumen, bukan skeleton's.
 */
export function usePreviewPlans(
  doc: ResumeDoc,
  templateId: TemplateId,
  canvasMode: boolean,
): PreviewPlans {
  const heights = useSettledHeights()
  const spec = useMemo(
    () => resolveSpec(templateId, doc.theme, doc.settings.page),
    [templateId, doc.theme, doc.settings.page],
  )

  return useMemo(() => {
    const content = createPagePlan(doc, spec, heights)
    if (!canvasMode) return { content, canvas: null }
    return { content, canvas: createPagePlan(doc, spec, heights, { guides: true }) }
  }, [doc, spec, heights, canvasMode])
}
