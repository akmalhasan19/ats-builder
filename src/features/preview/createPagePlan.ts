import type { ResumeDoc } from '@/types/resume'
import type { TemplateSpec } from '@/features/templates/specs'
import { buildBlocks } from './blocks'
import { paginateBlocks } from './paginate'
import { contentBoxOf, type HeightMap, type PagePlan } from './pagination'

/**
 * Jalur tunggal pembentukan rencana halaman untuk preview dan PDF (P4).
 * Hook layar hanya menyuplai tinggi blok yang telah diukur oleh DOM.
 */
export function createPagePlan(
  doc: ResumeDoc,
  spec: TemplateSpec,
  heights: HeightMap = {},
): PagePlan {
  const blocks = buildBlocks(doc, spec)
  const box = contentBoxOf(spec)
  const pages = paginateBlocks(blocks, box.contentHeightPx, heights)
  return { pages, blocks, pageCount: pages.length, ...box }
}
