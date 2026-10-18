import { describe, expect, it } from 'vitest'
import { A4_PX, mmToPx } from '@/lib/units'
import { createSampleDoc } from '@/schema/resume'
import { getSpec, resolveSpec } from '@/features/templates/specs'
import { buildBlocks } from '@/features/preview/blocks'
import { paginateBlocks } from '@/features/preview/paginate'
import { contentBoxOf, blockFootprintPx, type DocBlock } from '@/features/preview/pagination'
import { paginationDoc, type PaginationFixtureName } from '../fixtures/docs'

const block = (overrides: Partial<DocBlock> & Pick<DocBlock, 'key'>): DocBlock => ({
  kind: 'entry-line',
  sectionKind: 'experience',
  sectionId: 's1',
  padAfterMm: 0,
  estimatePx: 20,
  minWithNext: 0,
  ...overrides,
})

const entryLines = (count: number): DocBlock[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `s1:e1:l${index}`,
    kind: 'entry-line' as const,
    sectionKind: 'experience' as const,
    sectionId: 's1',
    itemId: 'e1',
    lineIndex: index,
    entryLineCount: count,
    padAfterMm: 0,
    estimatePx: 20,
    minWithNext: 0,
  }))

const entryHead = (lineCount: number): DocBlock => ({
  key: 's1:e1:head',
  kind: 'entry-head',
  sectionKind: 'experience',
  sectionId: 's1',
  itemId: 'e1',
  entryLineCount: lineCount,
  padAfterMm: 0,
  estimatePx: 20,
  minWithNext: Math.min(2, lineCount),
})

const sectionHeading = (): DocBlock => ({
  key: 's1:heading',
  kind: 'section-heading',
  sectionKind: 'experience',
  sectionId: 's1',
  padAfterMm: 0,
  estimatePx: 20,
  minWithNext: 2,
})

const placed = (pages: DocBlock[][]): DocBlock[] => pages.flat()

/** Tidak ada halaman yang boleh terisi melebihi tinggi konten. */
const assertNoOverflow = (pages: DocBlock[][], contentHeightPx: number): void => {
  for (const page of pages) {
    const total = page.reduce((sum, item) => sum + blockFootprintPx(item, {}), 0)
    expect(total <= contentHeightPx || page.length === 1).toBe(true)
  }
}

describe('contentBox & resolveSpec (§3 keputusan #2, T6.1)', () => {
  it('tinggi konten = 1123 − 2 × margin dalam px', () => {
    const box = contentBoxOf(resolveSpec('ledger', { fontScale: 1 }, { marginMm: 16 }))
    expect(box.marginPx).toBeCloseTo(mmToPx(16), 6)
    expect(box.contentHeightPx).toBeCloseTo(A4_PX.h - mmToPx(16) * 2, 6)
    expect(box.contentWidthPx).toBeCloseTo(A4_PX.w - mmToPx(16) * 2, 6)
  })

  it('margin dokumen mengoverride spec dan fontScale mengali ukuran tipe', () => {
    const spec = resolveSpec('ledger', { fontScale: 1.1 }, { marginMm: 20 })
    expect(spec.marginMm).toBe(20)
    expect(spec.typeScale.body.sizePt).toBeCloseTo(10 * 1.1, 6)
    expect(getSpec('ledger').typeScale.body.sizePt).toBe(10)
  })

  it('teknician memakai margin 14 mm dan heading monospace +0,10em', () => {
    const spec = getSpec('technician')
    expect(spec.marginMm).toBe(14)
    expect(spec.typeScale.heading.font).toBe('plexMono')
    expect(spec.typeScale.heading.trackingEm).toBeCloseTo(0.1, 6)
    expect(spec.headingStyle.rule.kind).toBe('dotted')
  })
})

describe('buildBlocks (T4.2)', () => {
  const doc = createSampleDoc()
  const blocks = buildBlocks(doc, resolveSpec('ledger', doc.theme, doc.settings.page))

  it('header profil pertama, tiap bagian punya heading sebelum isinya', () => {
    expect(blocks[0]?.kind).toBe('header')
    const sections = blocks.filter((item) => item.kind === 'section-heading')
    expect(sections.length).toBeGreaterThan(1)
    for (const [index, item] of blocks.entries()) {
      if (item.kind !== 'section-heading') continue
      expect(['entry-head', 'entry-line', 'skill-group', 'summary']).toContain(
        blocks[index + 1]?.kind,
      )
    }
  })

  it('bagian tersembunyi dan entri kosong tidak menghasilkan blok', () => {
    const hidden = {
      ...doc,
      sections: doc.sections.map((section) => ({ ...section, visible: false })),
    }
    expect(buildBlocks(hidden, getSpec('ledger'))).toEqual([])

    const blank = {
      ...doc,
      sections: doc.sections.map((section) =>
        section.kind === 'projects' ? { ...section, data: { entries: [] } } : section,
      ),
    }
    const kinds = buildBlocks(blank, getSpec('ledger'))
      .filter((item) => item.sectionKind === 'projects')
      .map((item) => item.kind)
    expect(kinds).not.toContain('entry-head')
  })

  it('ruang setelah blok hanya berisi nilai gap dari spec', () => {
    const spec = resolveSpec('ledger', doc.theme, doc.settings.page)
    const allowed = new Set<number>([0, ...Object.values(spec.gapMm)])
    for (const item of blocks) expect(allowed.has(item.padAfterMm)).toBe(true)
    const heading = blocks.find((item) => item.kind === 'section-heading')!
    expect(heading.padAfterMm).toBe(spec.gapMm.ruleToBody)
    expect(heading.estimatePx).toBeGreaterThanOrEqual(mmToPx(heading.padAfterMm))
  })
})

describe('paginateBlocks — aturan anti-janda (T4.2)', () => {
  it('heading tidak ditinggal sendirian di ujung halaman', () => {
    const blocks = [
      block({ key: 'fill' }),
      sectionHeading(),
      block({ key: 'b1' }),
      block({ key: 'b2' }),
    ]
    const pages = paginateBlocks(blocks, 60)
    expect(pages.map((page) => page.map((item) => item.key))).toEqual([
      ['fill'],
      ['s1:heading', 'b1', 'b2'],
    ])
  })

  it('kepala entri pindah bersama minimal dua baris pertamanya', () => {
    const lines = entryLines(4)
    const blocks = [block({ key: 'fill', estimatePx: 60 }), entryHead(4), ...lines]
    const pages = paginateBlocks(blocks, 100)
    expect(pages[0]?.at(-1)?.kind).not.toBe('entry-head')
    expect(pages[0]?.map((item) => item.key)).toEqual(['fill'])
  })

  it('janda: satu baris terakhir sendirian ditarik ke halaman berikut', () => {
    const lines = entryLines(5)
    const pages = paginateBlocks([entryHead(5), ...lines], 100)
    expect(pages.map((page) => page.length)).toEqual([4, 2])
    expect(pages[1]?.map((item) => item.key)).toEqual(['s1:e1:l3', 's1:e1:l4'])
  })

  it('run yang tidak mungkin dibagi 2/2 dibiarkan pecah biasa, tanpa halaman jebol', () => {
    const lines = entryLines(3)
    const pages = paginateBlocks([entryHead(3), ...lines], 60)
    expect(pages.map((page) => page.length)).toEqual([3, 1])
    expect(pages[0]?.at(-1)?.kind).toBe('entry-line')
    assertNoOverflow(pages, 60)
  })

  it('tinggi terukur dipakai, bukan perkiraan', () => {
    const blocks = [entryHead(2), ...entryLines(2)]
    const estimated = paginateBlocks(blocks, 70)
    const measured = paginateBlocks(blocks, 70, { 's1:e1:l1': 50 })
    expect(estimated.length).toBe(1)
    expect(measured.length).toBe(2)
  })
})

describe('fixture pendek / sedang / panjang (Gate Fase 4)', () => {
  const names: PaginationFixtureName[] = ['pendek', 'sedang', 'panjang']
  const counts = names.map((name) => {
    const doc = paginationDoc(name)
    const spec = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    const blocks = buildBlocks(doc, spec)
    const pages = paginateBlocks(blocks, contentBoxOf(spec).contentHeightPx)
    return { name, doc, spec, blocks, pages }
  })

  for (const { name, spec, blocks, pages } of counts) {
    it(`${name}: ${pages.length} halaman, semua blok terplaced tanpa overflow`, () => {
      expect(placed(pages).map((item) => item.key)).toEqual(blocks.map((item) => item.key))
      assertNoOverflow(pages, contentBoxOf(spec).contentHeightPx)
      for (const page of pages) expect(page.length).toBeGreaterThan(0)
    })
  }

  it('jumlah halaman naik mengikuti panjang dokumen', () => {
    const pendek = counts[0]!.pages.length
    const sedang = counts[1]!.pages.length
    const panjang = counts[2]!.pages.length
    expect(pendek).toBe(1)
    expect(sedang).toBeGreaterThan(pendek)
    expect(panjang).toBeGreaterThan(sedang)
    expect(panjang).toBeGreaterThanOrEqual(3)
  })
})
