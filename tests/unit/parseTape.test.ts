import { describe, expect, it } from 'vitest'
import { createPagePlan } from '@/features/preview/createPagePlan'
import { resolveSpec } from '@/features/templates/specs'
import { simulateParseOrder, tapeText } from '@/features/ats/parseTape'
import { SAMPLE_IDS, sampleResume } from '../fixtures/sampleResume'
import type { ResumeDoc, SectionInstance } from '@/types/resume'
import type { TemplateId } from '@/types/resume'

const tape = (doc: ResumeDoc, templateId: TemplateId) => {
  const spec = resolveSpec(templateId, doc.theme, doc.settings.page)
  const plan = createPagePlan(doc, spec)
  return simulateParseOrder(doc, spec, plan)
}

const tagsOf = (doc: ResumeDoc, templateId: TemplateId): string[] =>
  tape(doc, templateId).lines.map((line) => line.tag)

describe('parseTape.ts — urutan render', () => {
  it('[lolos] nama & kontak datang lebih dulu, urut sesuai blok header', () => {
    const { lines } = tape(sampleResume(), 'ledger')
    expect(lines[0]).toMatchObject({ tag: 'NAME', text: 'Alex Morgan' })
    expect(lines[1]).toMatchObject({ tag: 'HEADLINE', text: 'Software Engineer' })
    expect(lines.slice(2, 5).map((line) => line.tag)).toEqual(['EMAIL', 'PHONE', 'LOCATION'])
    expect(lines[5]).toMatchObject({ tag: 'LINK' })
  })

  it('[lolos] heading datang sebelum isi bagiannya', () => {
    const { lines } = tape(sampleResume(), 'ledger')
    const headingAt = lines.findIndex((line) => line.tag === 'HEADING')
    const firstBulletAt = lines.findIndex((line) => line.tag === 'BULLET')
    expect(headingAt).toBeGreaterThan(0)
    expect(firstBulletAt).toBeGreaterThan(headingAt)
  })

  it('[lolos] label heading mengikuti transform template', () => {
    expect(tagsOf(sampleResume(), 'ledger')).toContain('HEADING')
    const ledgerLines = tape(sampleResume(), 'ledger').lines.filter((l) => l.tag === 'HEADING')
    // ledger uppercase → teksnya kapital; executive small-caps → asli.
    expect(ledgerLines.map((line) => line.text)).toContain('PENGALAMAN')
    const executive = tape(sampleResume(), 'executive').lines.filter((l) => l.tag === 'HEADING')
    expect(executive.map((line) => line.text)).toContain('Pengalaman')
  })

  it('[lolos] tanggal-kanan: DATE tepat setelah judul, sebelum meta', () => {
    const right = tape(sampleResume(), 'classic-ats')
    const titleAt = right.lines.findIndex((line) => line.tag === 'ENTRY_TITLE')
    expect(right.lines[titleAt + 1]).toMatchObject({ tag: 'ORG', text: 'Tech Nusantara Corp' })
    expect(right.lines[titleAt + 2]).toMatchObject({ tag: 'DATE', text: 'Apr 2022 – SEKARANG' })
    expect(right.lines[titleAt + 3]).toMatchObject({ tag: 'META', text: 'Jakarta, Indonesia' })
  })

  it('[lolos] tanggal baris-bersusulan: meta (lokasi) dulu baru tanggal', () => {
    const nextLine = tape(sampleResume(), 'ledger')
    const titleAt = nextLine.lines.findIndex((line) => line.tag === 'ENTRY_TITLE')
    expect(nextLine.lines[titleAt + 1]).toMatchObject({ tag: 'ORG', text: 'Tech Nusantara Corp' })
    expect(nextLine.lines[titleAt + 2]).toMatchObject({ tag: 'META', text: 'Jakarta, Indonesia' })
    expect(nextLine.lines[titleAt + 3]).toMatchObject({ tag: 'DATE', text: 'Apr 2022 – SEKARANG' })
  })

  it('[lolos] baris tanpa bullet (stack, URL) ditandai META', () => {
    const { lines } = tape(sampleResume(), 'ledger')
    expect(lines.some((line) => line.tag === 'META' && line.text.startsWith('Teknologi:'))).toBe(
      true,
    )
    expect(lines.some((line) => line.text === 'https://github.com/alexmorgan/transit-api')).toBe(
      true,
    )
  })

  it('[lolos] bagian disembunyikan tidak muncul di tape', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance =>
        section.id === SAMPLE_IDS.projects ? { ...section, visible: false } : section,
      ),
    }
    const text = tapeText(tape(doc, 'ledger').lines)
    expect(text).not.toContain('Open Transit API')
    expect(tapeText(tape(sampleResume(), 'ledger').lines)).toContain('Open Transit API')
  })

  it('[blocking] karakter yang tidak bisa dipetakan ditandai UNCLAIMED', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance => {
        if (section.kind !== 'experience' || !('entries' in section.data)) return section
        return {
          ...section,
          data: { entries: [{ ...section.data.entries[0]!, bullets: ['Membangun ✨ unggulan'] }] },
        } as SectionInstance
      }),
    }
    const unclaimed = tape(doc, 'ledger').lines.filter((line) => line.tag === 'UNCLAIMED')
    expect(unclaimed).toHaveLength(1)
    expect(unclaimed[0]?.text).toBe('Membangun ✨ unggulan')
    expect(tape(doc, 'ledger').lines.some((line) => line.tag === 'BULLET')).toBe(true)
  })
})

describe('parseTape.ts — statistik footer', () => {
  it('[lolos] karakter, kata, dan halaman dihitung dari baris tape', () => {
    const { lines, stats } = tape(sampleResume(), 'ledger')
    const joined = lines.map((line) => line.text).join(' ')
    expect(stats.chars).toBe(joined.length)
    expect(stats.words).toBe(joined.split(/\s+/).filter(Boolean).length)
    expect(stats.pages).toBe(2)
  })

  it('[lolos] halaman mengikuti rencana pagination yang diberikan', () => {
    const long: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance => {
        if (section.kind !== 'experience' || !('entries' in section.data)) return section
        return { ...section, data: { entries: [] } } as SectionInstance
      }),
    }
    const spec = resolveSpec('ledger', long.theme, long.settings.page)
    const blocks = Array.from({ length: 60 }, (_, i) => ({
      key: `bullets.extra.${i}`,
      kind: 'entry-line' as const,
      sectionKind: 'experience' as const,
      sectionId: SAMPLE_IDS.experience,
      itemId: 'exp-1',
      lineIndex: i,
      padAfterMm: 1.4,
      estimatePx: 400,
      minWithNext: 0,
    }))
    const threePages = [blocks.slice(0, 20), blocks.slice(20, 40), blocks.slice(40)]
    const plan = {
      ...createPagePlan(long, spec),
      blocks,
      pages: threePages,
      pageCount: threePages.length,
    }
    expect(simulateParseOrder(long, spec, plan).stats.pages).toBe(3)
  })
})
