import { A4_PX, mmToPx } from '@/lib/units'
import type { SectionKind } from '@/schema/resume'
import type { TemplateSpec } from '@/features/templates/specs'

/**
 * Mesin pagination layar (T4.2). Keluarannya — blok per halaman — dipakai juga
 * renderer PDF Fase 5, jadi pemecahan halaman dihitung satu kali (P4).
 */

export type BlockKind =
  'header' | 'section-heading' | 'entry-head' | 'summary' | 'skill-group' | 'entry-line'

export type DocBlock = {
  key: string
  kind: BlockKind
  sectionKind: SectionKind
  sectionId: string
  /** Entri atau grup keahlian pemilik blok ini; dipakai aturan orphans/widows. */
  itemId?: string
  lineIndex?: number
  entryLineCount?: number
  /** Ruang setelah blok, menjadi padding blok itu sendiri — tinggi terukur = footprint. */
  padAfterMm: number
  /** Perkiraan tinggi sebelum DOM mengukur; dipakai paint pertama & jsdom. */
  estimatePx: number
  /** Blok ini tidak boleh jadi blok terakhir di halaman (heading & kepala entri). */
  minWithNext: number
}

export type HeightMap = Record<string, number>

export type PagePlan = {
  pages: DocBlock[][]
  blocks: DocBlock[]
  pageCount: number
  marginPx: number
  contentWidthPx: number
  contentHeightPx: number
}

export const contentBoxOf = (spec: TemplateSpec) => {
  const marginPx = mmToPx(spec.marginMm)
  return {
    marginPx,
    contentWidthPx: A4_PX.w - marginPx * 2,
    contentHeightPx: A4_PX.h - marginPx * 2,
  }
}

export const blockFootprintPx = (block: DocBlock, heights: HeightMap): number =>
  heights[block.key] ?? block.estimatePx
