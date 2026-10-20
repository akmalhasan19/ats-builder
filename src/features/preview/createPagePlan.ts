import type { ResumeDoc } from '@/types/resume'
import type { TemplateSpec } from '@/features/templates/specs'
import { buildBlocks } from './blocks'
import { paginateBlocks } from './paginate'
import { contentBoxOf, type HeightMap, type PagePlan } from './pagination'

/**
 * Jalur tunggal pembentukan rencana halaman untuk preview dan PDF (P4).
 * Hook layar hanya menyuplai tinggi blok yang telah diukur oleh DOM.
 *
 * `guides` menambah blok placeholder untuk field kosong — hanya mode kanvas
 * memakainya (C2). Jalur PDF (renderer & ekspor) TIDAK pernah memakai opsi ini,
 * jadi guide tidak pernah masuk berkas dan pemecahan halaman PDF tidak ikut
 * berubah karena mode kerja.
 */
export function createPagePlan(
  doc: ResumeDoc,
  spec: TemplateSpec,
  heights: HeightMap = {},
  options: { guides?: boolean } = {},
): PagePlan {
  const blocks = buildBlocks(doc, spec, options)
  const box = contentBoxOf(spec)
  const split = paginateBlocks(blocks, box.contentHeightPx, heights)
  // QA Fase 9: dokumen kosong (tanpa bagian terlihat) dulu menghasilkan rencana
  // 0 halaman, padahal renderer PDF selalu menulis satu lembar — preview
  // "HAL 0 / 0" ≠ PDF. Satu lembar kosong menyelaraskan kedua jalur (P4).
  const pages = split.length > 0 ? split : [[]]
  return { pages, blocks, pageCount: pages.length, ...box }
}
