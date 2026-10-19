import { describe, expect, it } from 'vitest'
import { bandOf, countBySeverity, scoreOf, tickColors, TICK_COUNT } from '@/features/ats/scoring'
import { buildReport, docSignature } from '@/features/ats/engine'
import { sampleResume, SAMPLE_IDS } from '../fixtures/sampleResume'
import { JOB_DESCRIPTION } from '../fixtures/jobDescription'
import type { ResumeDoc, SectionInstance } from '@/types/resume'

const report = (doc: ResumeDoc, pageCount: number): ReturnType<typeof buildReport> =>
  buildReport(doc, pageCount, 0)

describe('scoring.ts', () => {
  it('dokumen bersih → skor tinggi dan band Sangat baik', () => {
    expect(scoreOf([])).toBe(100)
    expect(bandOf(100)).toMatchObject({ labelId: 'ats.band.excellent', colorKey: 'signal-ok' })
    expect(bandOf(90)).toMatchObject({ labelId: 'ats.band.excellent' })
    expect(bandOf(89)).toMatchObject({ labelId: 'ats.band.good', colorKey: 'accent' })
    expect(bandOf(75)).toMatchObject({ labelId: 'ats.band.good' })
    expect(bandOf(74)).toMatchObject({ labelId: 'ats.band.fair', colorKey: 'signal-warn' })
    expect(bandOf(50)).toMatchObject({ labelId: 'ats.band.fair' })
    expect(bandOf(49)).toMatchObject({ labelId: 'ats.band.low', colorKey: 'signal-bad' })
    expect(bandOf(0)).toMatchObject({ labelId: 'ats.band.low' })
  })

  it('potongan bad dibatasi maksimal 48 poin', () => {
    const manyBad = Array.from({ length: 8 }, (_, index) => ({
      id: `b${index}`,
      ruleId: 'x',
      severity: 'bad' as const,
      titleId: 'ats.band.low' as const,
      detailId: 'ats.band.low' as const,
      points: 12,
    }))
    expect(scoreOf(manyBad)).toBe(52)
    expect(scoreOf(manyBad.slice(0, 4))).toBe(52)
    expect(scoreOf(manyBad.slice(0, 3))).toBe(64)
  })

  it('potongan warn dibatasi 24 dan info dibatasi 6', () => {
    const warn = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `w${i}`,
        ruleId: 'x',
        severity: 'warn' as const,
        titleId: 'ats.band.fair' as const,
        detailId: 'ats.band.fair' as const,
        points: 4,
      }))
    const info = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `i${i}`,
        ruleId: 'x',
        severity: 'info' as const,
        titleId: 'ats.band.fair' as const,
        detailId: 'ats.band.fair' as const,
        points: 1,
      }))
    expect(scoreOf(warn(10))).toBe(76)
    expect(scoreOf(info(20))).toBe(94)
    expect(scoreOf([...warn(6), ...info(3)])).toBe(73)
    expect(countBySeverity([...warn(6), ...info(3)])).toEqual({ bad: 0, warn: 6, info: 3, ok: 0 })
  })

  it('lantai 0 bahkan bila semua aturan dinyalakan buruk', () => {
    const flood = Array.from({ length: 20 }, (_, i) => ({
      id: `x${i}`,
      ruleId: 'x',
      severity: 'bad' as const,
      titleId: 'ats.band.low' as const,
      detailId: 'ats.band.low' as const,
      points: 12,
    }))
    expect(scoreOf(flood)).toBe(52)
  })

  it('bar tick selalu 20 dan berurutan bad → warn → info → ok', () => {
    const ticks = tickColors({ bad: 2, warn: 3, info: 1, ok: 0 })
    expect(ticks).toHaveLength(TICK_COUNT)
    expect(ticks.slice(0, 6)).toEqual(['bad', 'bad', 'warn', 'warn', 'warn', 'info'])
    expect(ticks.slice(6)).toEqual(Array.from({ length: 14 }, () => 'ok'))
  })
})

describe('engine deterministik (Gate Fase 7)', () => {
  it('dokumen sama → skor & daftar isu identik (snapshot)', () => {
    const first = report(sampleResume(), 2)
    const second = report(sampleResume(), 2)
    expect(second.score).toBe(first.score)
    expect(second.issues.map((issue) => issue.id)).toEqual(first.issues.map((issue) => issue.id))
    expect(second.band.labelId).toBe(first.band.labelId)
  })

  it('snapshot skor dokumen contoh pada 1, 2, dan 3 halaman', () => {
    // Dokumen contoh hanya kena satu aturan: bullet proyek tidak diawali kata
    // kerja aksi ("Community REST API serving…") → 100 − 4 = 96.
    // Pengalamannya 86 bulan (≥ 3 tahun), jadi 2 halaman masih wajar — batas.
    expect(report(sampleResume(), 1).score).toBe(96)
    expect(report(sampleResume(), 1).band.labelId).toBe('ats.band.excellent')
    expect(report(sampleResume(), 2).score).toBe(96)
    expect(report(sampleResume(), 3).score).toBe(92)
  })

  it('surat kabar halaman mengubah aturan panjang dokumen saja', () => {
    const one = report(sampleResume(), 2)
    const two = report(sampleResume(), 3)
    const lengthOne = one.issues.filter((issue) => issue.ruleId === 'length.pages')
    const lengthTwo = two.issues.filter((issue) => issue.ruleId === 'length.pages')
    expect(lengthOne.map((issue) => issue.id)).toEqual(['length.summary'])
    expect(lengthTwo.map((issue) => issue.id)).toEqual(['length.overLimit'])
    expect(lengthTwo[0]?.params).toMatchObject({ pages: 3, max: 2 })
    expect(two.score).toBe(one.score - 4)
    const stripLength = (ids: readonly string[]): string[] =>
      ids.filter((id) => id !== 'length.summary' && id !== 'length.overLimit')
    expect(stripLength(one.issues.map((i) => i.id))).toEqual(
      stripLength(two.issues.map((i) => i.id)),
    )
  })

  it('dokumen rusak → skor jatuh ke band rendah dengan banyak isu bad', () => {
    const broken: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance => {
        if (section.kind === 'profile')
          return {
            ...section,
            data: { ...section.data, email: '', phone: '12', location: '', links: [] },
          }
        if (section.kind === 'projects' && 'entries' in section.data)
          return {
            ...section,
            data: { entries: [{ ...section.data.entries[0]!, bullets: ['a'.repeat(5)] }] },
          }
        return { ...section, visible: false }
      }),
    }
    const result = report(broken, 4)
    expect(result.score).toBeLessThan(50)
    expect(result.band.labelId).toBe('ats.band.low')
    expect(result.band.colorKey).toBe('signal-bad')
    expect(result.issues.filter((issue) => issue.severity === 'bad').length).toBeGreaterThanOrEqual(
      4,
    )
  })

  it('laporan membawa kata kunci hanya bila ada deskripsi lowongan', () => {
    const withJd = report({ ...sampleResume(), jobDescription: JOB_DESCRIPTION }, 2)
    expect(withJd.keywords?.matched.length).toBeGreaterThan(0)
    expect(report(sampleResume(), 2).keywords).toBeNull()
  })
})

describe('docSignature', () => {
  it('lastCheckedAt tidak memicu pemeriksaan ulang', () => {
    const doc = sampleResume()
    const after = { ...doc, meta: { ...doc.meta, lastCheckedAt: 1750000000000 } }
    expect(docSignature(after)).toBe(docSignature(doc))
  })

  it('perubahan isi dokumen mengubah tanda tangan', () => {
    const doc = sampleResume()
    const edited: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section): SectionInstance => {
        if (section.kind !== 'summary') return section
        return { ...section, data: { text: 'Ringkasan lain.' } }
      }),
    }
    expect(docSignature(edited)).not.toBe(docSignature(doc))
  })

  it('bagian yang disembunyikan tetap mengubah tanda tangan', () => {
    const doc = sampleResume()
    const hidden: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section): SectionInstance =>
        section.id === SAMPLE_IDS.projects ? { ...section, visible: false } : section,
      ),
    }
    expect(docSignature(hidden)).not.toBe(docSignature(doc))
  })
})
