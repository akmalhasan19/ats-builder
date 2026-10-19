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
  const split = paginateBlocks(blocks, box.contentHeightPx, heights)
  // QA Fase 9: dokumen kosong (tanpa bagian terlihat) dulu menghasilkan rencana
  // 0 halaman, padahal renderer PDF selalu menulis satu lembar — preview
  // "HAL 0 / 0" ≠ PDF. Satu lembar kosong menyelaraskan kedua jalur (P4).
  const pages = split.length > 0 ? split : [[]]
  return { pages, blocks, pageCount: pages.length, ...box }
}
