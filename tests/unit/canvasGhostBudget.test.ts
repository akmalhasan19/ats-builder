import { describe, expect, it } from 'vitest'
import { CANVAS_GHOST_RESERVE_PX, canvasGhostExtraPxOf } from '@/features/canvas/canvasGhosts'
import { paginateBlocks } from '@/features/preview/paginate'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { blockFootprintPx, contentBoxOf, type DocBlock } from '@/features/preview/pagination'
import { getSpec } from '@/features/templates/specs'
import { createSampleDoc } from '@/schema/resume'

/**
 * FASE 12 C5 — keputusan owner atas temuan ⛔ C4.4 (opsi A): anggaran halaman
 * rencana kanvas menyisakan ruang ghost row. Pass isi (ATS/PDF) tidak memakai
 * opsi ini, jadi paritasnya tetap.
 */

const base = {
  kind: 'entry-line' as const,
  sectionKind: 'experience' as const,
  sectionId: 's1',
  padAfterMm: 0,
  estimatePx: 20,
  minWithNext: 0,
}

const mk = (overrides: Partial<DocBlock> & Pick<DocBlock, 'key'>): DocBlock => ({
  ...base,
  ...overrides,
})

describe('canvasGhostExtraPxOf — jangkar ghost', () => {
  const blocks: DocBlock[] = [
    mk({ key: 's1:heading', kind: 'section-heading', sectionId: 's1' }),
    mk({
      key: 's1:e1:head',
      kind: 'entry-head',
      sectionId: 's1',
      itemId: 'e1',
      entryLineCount: 2,
    }),
    mk({ key: 's1:e1:l0', sectionId: 's1', itemId: 'e1', lineIndex: 0, entryLineCount: 2 }),
    mk({ key: 's1:e1:l1', sectionId: 's1', itemId: 'e1', lineIndex: 1, entryLineCount: 2 }),
    mk({
      key: 's2:heading',
      kind: 'section-heading',
      sectionKind: 'education',
      sectionId: 's2',
    }),
    mk({
      key: 's2:e2:head',
      kind: 'entry-head',
      sectionKind: 'education',
      sectionId: 's2',
      itemId: 'e2',
      entryLineCount: 1,
    }),
    mk({
      key: 's2:e2:l0',
      kind: 'entry-line',
      sectionKind: 'education',
      sectionId: 's2',
      itemId: 'e2',
      lineIndex: 0,
      entryLineCount: 1,
    }),
  ]

  it('jadwal ghost = jumlah ghost pada blok jangkar × reserve', () => {
    const extras = canvasGhostExtraPxOf(blocks)
    // Blok terakhir entri pengalaman = ghost bullet + ghost entri (akhir bagian).
    expect(extras.get('s1:e1:l1')).toBe(2 * CANVAS_GHOST_RESERVE_PX)
    // Blok terakhir pendidikan juga mengakhiri dokumen: bullet + entri + bagian.
    expect(extras.get('s2:e2:l0')).toBe(3 * CANVAS_GHOST_RESERVE_PX)
    // Blok non-jangkar tidak direserve.
    expect(extras.get('s1:heading')).toBeUndefined()
    expect(extras.get('s1:e1:head')).toBeUndefined()
  })
})

describe('paginateBlocks dengan reserve ghost — keputusan opsi (A)', () => {
  const heading: DocBlock = {
    key: 's1:heading',
    kind: 'section-heading',
    sectionKind: 'experience',
    sectionId: 's1',
    padAfterMm: 0,
    estimatePx: 20,
    minWithNext: 2,
  }
  const head: DocBlock = {
    key: 's1:e1:head',
    kind: 'entry-head',
    sectionKind: 'experience',
    sectionId: 's1',
    itemId: 'e1',
    entryLineCount: 2,
    padAfterMm: 0,
    estimatePx: 20,
    minWithNext: 0,
  }
  const lines: DocBlock[] = [
    mk({ key: 's1:e1:l0', sectionId: 's1', itemId: 'e1', lineIndex: 0, entryLineCount: 2 }),
    mk({ key: 's1:e1:l1', sectionId: 's1', itemId: 'e1', lineIndex: 1, entryLineCount: 2 }),
  ]
  const all = [heading, head, ...lines]

  it('tanpa reserve: satu run 80 px muat satu halaman 120 px', () => {
    expect(paginateBlocks(all, 120)).toHaveLength(1)
  })

  it('dengan reserve: run terakhir pindah utuh ke halaman baru bersama ghost-nya', () => {
    const pages = paginateBlocks(all, 120, {}, (block) =>
      block.key === 's1:e1:l1' ? CANVAS_GHOST_RESERVE_PX : 0,
    )
    // run (l0,l1) + ruang ghost tidak muat lagi setelah heading+head, jadi run
    // janda/yatim terbawa utuh ke halaman baru — ghost ikut satu halaman.
    expect(pages).toEqual([
      [heading, head],
      [lines[0]!, lines[1]!],
    ])
    for (const page of pages) {
      const total = page.reduce((sum, item) => sum + blockFootprintPx(item, {}), 0)
      expect(total).toBeLessThanOrEqual(120)
    }
  })
})

describe('createPagePlan guides — anggaran ghost di rencana kanvas', () => {
  it('setiap halaman pass kanvas masih memuat footprint + reserve ghost', () => {
    const doc = createSampleDoc()
    const spec = getSpec(doc.templateId)
    const plan = createPagePlan(doc, spec, {}, { guides: true })
    const extras = canvasGhostExtraPxOf(plan.blocks)
    expect(extras.size).toBeGreaterThan(0)
    const box = contentBoxOf(spec)
    for (const page of plan.pages) {
      const total = page.reduce(
        (sum, item) => sum + blockFootprintPx(item, {}) + (extras.get(item.key) ?? 0),
        0,
      )
      expect(total).toBeLessThanOrEqual(box.contentHeightPx)
    }
  })

  it('pass isi (tanpa guides) tidak dibebani reserve ghost', () => {
    const doc = createSampleDoc()
    const spec = getSpec(doc.templateId)
    const plan = createPagePlan(doc, spec)
    const extras = canvasGhostExtraPxOf(plan.blocks)
    expect(extras.size).toBeGreaterThanOrEqual(0)
    const box = contentBoxOf(spec)
    for (const page of plan.pages) {
      // Pass isi tidak memakai reserve: pemeriksaan fit memakai footprint polos,
      // persis perilaku sebelum fase ini.
      const total = page.reduce((sum, item) => sum + blockFootprintPx(item, {}), 0)
      expect(total).toBeLessThanOrEqual(box.contentHeightPx)
    }
  })
})
