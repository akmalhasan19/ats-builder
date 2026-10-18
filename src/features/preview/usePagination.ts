import { useMemo } from 'react'
import type { ResumeDoc, TemplateId } from '@/types/resume'
import { resolveSpec } from '@/features/templates/specs'
import { useSettledHeights } from '@/store/previewStore'
import { createPagePlan } from './createPagePlan'
import type { PagePlan } from './pagination'

/**
 * Rencana halaman untuk satu dokumen (T4.2). Dipakai renderer layar sekarang dan
 * renderer PDF di Fase 5, supaya pemecahan halaman identik (P4).
 */
export function usePagination(doc: ResumeDoc, templateId: TemplateId): PagePlan {
  const heights = useSettledHeights()
  const spec = useMemo(
    () => resolveSpec(templateId, doc.theme, doc.settings.page),
    [templateId, doc.theme, doc.settings.page],
  )

  return useMemo(() => createPagePlan(doc, spec, heights), [doc, spec, heights])
}
