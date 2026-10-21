import type { ResumeDoc } from '@/types/resume'
import type { TemplateSpec } from '@/features/templates/specs'
import { buildBlocks } from './blocks'
import { paginateBlocks } from './paginate'
import { canvasGhostExtraPxOf } from '@/features/canvas/canvasGhosts'
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
  // FASE 12 C5 — keputusan owner atas temuan ⛔ C4.4 (opsi A): pass kanvas
  // menyisakan ruang ghost row + marginnya dalam anggaran setiap blok jangkar,
  // sehingga blok terakhir yang tidak muat pindah ke halaman baru BERSAMA
  // ghost-nya dan tidak ada ghost yang terpotong dasar kotak konten. Pass isi
  // (ATS tape, ekspor PDF) tidak memakai `guides`, jadi PDF tetap dibagi
  // tanpa ruang ghost dan jesti paritasnya tidak disentuh.
  const ghostExtras = options.guides === true ? canvasGhostExtraPxOf(blocks) : null
  const split = paginateBlocks(
    blocks,
    box.contentHeightPx,
    heights,
    ghostExtras ? (block) => ghostExtras.get(block.key) ?? 0 : undefined,
  )
  // QA Fase 9: dokumen kosong (tanpa bagian terlihat) dulu menghasilkan rencana
  // 0 halaman, padahal renderer PDF selalu menulis satu lembar — preview
  // "HAL 0 / 0" ≠ PDF. Satu lembar kosong menyelaraskan kedua jalur (P4).
  const pages = split.length > 0 ? split : [[]]
  return { pages, blocks, pageCount: pages.length, ...box }
}
