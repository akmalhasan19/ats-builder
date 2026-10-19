import { describe, expect, it } from 'vitest'
import { checkContact, phoneDigits } from '@/features/ats/rules/contact'
import { checkSections } from '@/features/ats/rules/sections'
import { checkBullets } from '@/features/ats/rules/bullets'
import { checkDates, monthsOfExperience } from '@/features/ats/rules/dates'
import { checkLength } from '@/features/ats/rules/length'
import { checkForbidden } from '@/features/ats/rules/forbidden'
import { casingOf, checkConsistency } from '@/features/ats/rules/consistency'
import { extractKeywords, matchKeywords } from '@/features/ats/rules/keywords'
import { isCanonicalHeading } from '@/features/ats/rules/headings'
import { isActionVerb, startsWithActionVerb, startsWithPassive } from '@/features/ats/rules/verbs'
import { sectionRegistry } from '@/features/sections/registry'
import { DOC_LIMITS, type SectionKind } from '@/schema/resume'
import { t } from '@/lib/i18n'
import { SAMPLE_IDS, sampleResume } from '../fixtures/sampleResume'
import type { AtsIssue } from '@/features/ats/types'
import type { ResumeDoc, SectionInstance } from '@/types/resume'

/**
 * T9.x — cabang aturan ATS yang belum tertutup `tests/unit/atsRules.test.ts`:
 * dokumen tanpa profil, bullet di atas rentang ideal, banyak entri `current`,
 * entri berjalan bukan di puncak, tanggal tak terurai, foto menyala, aksen
 * dengan hex tidak valid, level angka model "Level 3", lowongan tanpa istilah,
 * format tanggal campur, dan bagian inti yang hilang total.
 */

const find = (issues: AtsIssue[], id: string): AtsIssue | undefined =>
  issues.find((issue) => issue.id === id)

/** Bullet dengan panjang persis `length` karakter (dipotong setelah dirakit). */
function bulletOf(length: number): string {
  const body = 'Membangun layanan rekonsiliasi inventaris yang'.padEnd(
    Math.max(0, length - 20),
    'x',
  )
  return `${body} memangkas biaya 40%`.slice(0, length)
}

const patchProfile = (patch: Record<string, unknown>): ResumeDoc =>
  ({
    ...sampleResume(),
    sections: sampleResume().sections.map((section): SectionInstance =>
      section.kind === 'profile'
        ? ({ ...section, data: { ...section.data, ...patch } } as typeof section)
        : section,
    ),
  }) as ResumeDoc

const patchSkills = (groups: { id: string; name: string; items: string[] }[]): ResumeDoc =>
  ({
    ...sampleResume(),
    sections: sampleResume().sections.map((section): SectionInstance =>
      section.kind === 'skills' ? ({ ...section, data: { groups } } as SectionInstance) : section,
    ),
  }) as ResumeDoc

/** Terapkan patch ke salah satu entri pengalaman berdasar id. */
const patchEntry = (
  entryId: string,
  patch: Record<string, unknown>,
  doc: ResumeDoc = sampleResume(),
): ResumeDoc => ({
  ...doc,
  sections: doc.sections.map((section): SectionInstance => {
    if (section.id !== SAMPLE_IDS.experience || section.kind !== 'experience') return section
    return {
      ...section,
      data: {
        entries: section.data.entries.map((entry) =>
          entry.id === entryId ? { ...entry, ...patch } : entry,
        ),
      },
    } as SectionInstance
  }),
})

const onlySections = (kinds: string[]): ResumeDoc => ({
  ...sampleResume(),
  sections: sampleResume()
    .sections.filter((section) => kinds.includes(section.kind))
    .map((section) => ({ ...section, visible: true })),
})

describe('contact.ts — dokumen tanpa profil', () => {
  it('bagian profile tidak ada → tidak ada isu sama sekali (bukan isu palsu)', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.filter((section) => section.kind !== 'profile'),
    }
    expect(checkContact(doc)).toEqual([])
  })

  it('telepon: hanya digit yang dihitung', () => {
    expect(phoneDigits('+62 812-3456 7890')).toBe(13)
    expect(phoneDigits('tidak ada angka')).toBe(0)
    expect(
      find(checkContact(patchProfile({ phone: '' })), 'contact.phone.short')?.params?.digits,
    ).toBe(0)
  })
})

describe('bullets.ts — batas panjang di atas rentang ideal', () => {
  it('bullet 195 karakter → warn terlalu panjang (belum sampai ambang bad 220)', () => {
    const issues = checkBullets(patchEntry('exp-1', { bullets: [bulletOf(195)] }))
    const issue = find(issues, 'bullets.exp-1.0.long')
    expect(issue?.severity).toBe('warn')
    expect(issue?.titleId).toBe('ats.bullets.tooLongWarn.title')
    expect(issue?.points).toBe(4)
    expect(issue?.params?.length).toBe(195)
    expect(issue?.params?.max).toBe(180)
    expect(issue?.target?.field).toBe('exp-exp-1-bullet-0')
    expect(Number(find(issues, 'bullets.summary')?.params?.warnLong)).toBe(1)
    expect(Number(find(issues, 'bullets.summary')?.params?.badLong)).toBe(0)
  })

  it('bullet 221 karakter → bad dan dihitung di bucket badLong', () => {
    const issues = checkBullets(patchEntry('exp-1', { bullets: [bulletOf(221)] }))
    expect(find(issues, 'bullets.exp-1.0.tooLong')?.severity).toBe('bad')
    expect(Number(find(issues, 'bullets.summary')?.params?.badLong)).toBe(1)
  })

  it('bullet kosong disaring sebelum dinilai (tanpa isu palsu)', () => {
    const issues = checkBullets(patchEntry('exp-1', { bullets: ['', '   ', bulletOf(60)] }))
    expect(issues.filter((issue) => issue.id.startsWith('bullets.exp-1.0'))).toEqual([])
    expect(issues.filter((issue) => issue.id.startsWith('bullets.exp-1.1'))).toEqual([])
    // 1 bullet 60 karakter (exp-1) + 2 bullet exp-2 + 1 bullet proyek.
    expect(Number(find(issues, 'bullets.summary')?.params?.total)).toBe(4)
  })
})

describe('dates.ts — entri berjalan & tanggal tak terurai', () => {
  it('dua entri ditandai berjalan → warn dengan target tanggal selesai entri kedua', () => {
    const doc = patchEntry('exp-1', { current: true }, patchEntry('exp-2', { current: true }))
    const issues = checkDates(doc)
    const issue = find(issues, 'dates.current.multiple')
    expect(issue?.severity).toBe('warn')
    expect(issue?.points).toBe(4)
    expect(issue?.params?.count).toBe(2)
    expect(issue?.target?.entryId).toBe('exp-2')
    expect(issue?.target?.field).toBe('exp-exp-2-dates-end')
    expect(find(issues, 'dates.current.position')).toBeUndefined()
  })

  it('entri berjalan bukan yang teratas → warn posisi, tanpa isu jumlah', () => {
    const doc = patchEntry(
      'exp-2',
      { current: true, endDate: '' },
      patchEntry('exp-1', { current: false, startDate: '2019-08', endDate: '2022-03' }),
    )
    const issues = checkDates(doc)
    const issue = find(issues, 'dates.current.position')
    expect(issue?.severity).toBe('warn')
    expect(issue?.fixHintId).toBe('ats.fix.reorderEntries')
    expect(issue?.target?.entryId).toBe('exp-2')
    expect(issue?.target?.field).toBeUndefined()
    expect(find(issues, 'dates.current.multiple')).toBeUndefined()
  })

  it('tanggal tidak berbentuk YYYY-MM dihitung sebagai unparseable di ringkasan', () => {
    const doc = patchEntry('exp-2', { startDate: '2022/08', endDate: 'Maret 2023' })
    const summary = find(checkDates(doc), 'dates.summary')
    expect(summary?.severity).toBe('ok')
    expect(summary?.params?.unparseable).toBe(2)
  })

  it('bagian berbahasa (tanpa tanggal) tidak menambah isu tanggal', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance =>
        section.kind === 'languages' ? ({ ...section, visible: true } as SectionInstance) : section,
      ),
    }
    expect(checkDates(doc)).toHaveLength(checkDates(sampleResume()).length)
    expect(find(checkDates(doc), 'dates.summary')).toBeDefined()
    expect(monthsOfExperience(doc)).toBe(monthsOfExperience(sampleResume()))
  })
})

describe('length.ts — halaman > 3 untuk semua jenjang', () => {
  it('junior 4 halaman → terlalu banyak, bukan sekadar over limit', () => {
    const junior = patchEntry('exp-1', { startDate: '2025-01', current: true, endDate: '' })
    const issues = checkLength(junior, 4)
    expect(find(issues, 'length.tooManyPages')?.severity).toBe('warn')
    expect(find(issues, 'length.overLimit')).toBeUndefined()
    expect(find(issues, 'length.summary')).toBeUndefined()
    expect(issues).toHaveLength(1)
  })

  it('senior: 2 halaman ok, 3 halaman over limit, 4 halaman terlalu banyak', () => {
    expect(monthsOfExperience(sampleResume())).toBeGreaterThanOrEqual(36)
    expect(find(checkLength(sampleResume(), 2), 'length.summary')?.severity).toBe('ok')
    expect(find(checkLength(sampleResume(), 2), 'length.summary')?.params?.max).toBe(2)
    expect(find(checkLength(sampleResume(), 3), 'length.overLimit')?.params?.max).toBe(2)
    expect(find(checkLength(sampleResume(), 4), 'length.tooManyPages')?.params?.max).toBe(3)
  })
})

describe('forbidden.ts — foto, aksen cacat, level angka teks', () => {
  it('photoEnabled → bad dengan target bagian profil', () => {
    const issue = find(checkForbidden(patchProfile({ photoEnabled: true })), 'forbidden.photo')
    expect(issue?.severity).toBe('bad')
    expect(issue?.points).toBe(12)
    expect(issue?.target?.sectionId).toBe(SAMPLE_IDS.profile)
    expect(issue?.fixHintId).toBe('ats.fix.removePhoto')
    expect(
      find(checkForbidden(patchProfile({ photoEnabled: true })), 'forbidden.summary'),
    ).toBeUndefined()
  })

  it('accentHex tidak valid → rasio nol, tetap dianggap merusak parsing', () => {
    const doc: ResumeDoc = { ...sampleResume(), theme: { accentHex: '#12', fontScale: 1 } }
    const issue = find(checkForbidden(doc), 'forbidden.accentContrast')
    expect(issue?.severity).toBe('bad')
    expect(issue?.params?.ratio).toBe(0)
    expect(issue?.params?.min).toBe(4.5)
  })

  it('aksen kontras tinggi tidak memicu isu', () => {
    const doc: ResumeDoc = { ...sampleResume(), theme: { accentHex: '#1B1B1B', fontScale: 1 } }
    expect(find(checkForbidden(doc), 'forbidden.accentContrast')).toBeUndefined()
    expect(find(checkForbidden(doc), 'forbidden.summary')?.severity).toBe('ok')
  })

  it('level angka model "Level 3" juga ditandai; skills tersembunyi tidak', () => {
    const rated = patchSkills([{ id: 'g-num', name: 'Framework', items: ['Level 3 React'] }])
    const issue = find(checkForbidden(rated), 'forbidden.skillLevel.g-num')
    expect(issue?.severity).toBe('warn')
    expect(issue?.params?.group).toBe('Framework')
    expect(issue?.params?.sample).toBe('Level 3 React')
    expect(issue?.target?.field).toBe('skill-group-g-num-items')

    const hidden: ResumeDoc = {
      ...rated,
      sections: rated.sections.map((section) =>
        section.kind === 'skills' ? { ...section, visible: false } : section,
      ),
    }
    expect(find(checkForbidden(hidden), 'forbidden.skillLevel.g-num')).toBeUndefined()
  })
})

describe('keywords.ts — lowongan tanpa istilah bermakna', () => {
  const NOISE = 'dan atau yang untuk dengan dari pada dalam ini itu'

  it('semua token stopwords → istilah kosong → matchKeywords null', () => {
    expect(extractKeywords(NOISE).terms).toEqual([])
    expect(matchKeywords({ ...sampleResume(), jobDescription: NOISE })).toBeNull()
  })

  it('jobDescription kosong / null juga null', () => {
    expect(matchKeywords({ ...sampleResume(), jobDescription: '   ' })).toBeNull()
    expect(matchKeywords({ ...sampleResume(), jobDescription: null })).toBeNull()
  })

  it('istilah multi-kata tetap masuk meski hanya muncul sekali', () => {
    const set = extractKeywords('React dan React dan code review sekali core Web Vitals')
    expect(set.terms.some((term) => term.includes(' '))).toBe(true)
    expect(set.terms.length).toBeLessThanOrEqual(20)
    expect(set.frequency.size).toBeGreaterThan(set.terms.length)
  })

  it('bagian tersembunyi tidak ikut dihitung sebagai isi dokumen', () => {
    // 'Kubernetes' & 'Docker' hanya ada di grup keahlian fixture.
    const jd = 'Kubernetes Kubernetes Docker Docker'
    const shown = matchKeywords({ ...sampleResume(), jobDescription: jd })
    expect(shown?.matched).toEqual(expect.arrayContaining(['kubernetes', 'docker']))

    const hidden: ResumeDoc = {
      ...sampleResume(),
      jobDescription: jd,
      sections: sampleResume().sections.map((section) =>
        section.kind === 'skills' ? { ...section, visible: false } : section,
      ),
    }
    const lost = matchKeywords(hidden)
    expect(lost?.matched).not.toContain('kubernetes')
    expect(lost?.missing).toEqual(expect.arrayContaining(['kubernetes', 'docker']))
    expect((lost?.density ?? 0) < (shown?.density ?? 1)).toBe(true)
  })
})

describe('consistency.ts — format tanggal campur', () => {
  it('tanggal tak seragam → warn dengan sampel & target entri pertama yang cacat', () => {
    const doc = patchEntry('exp-2', { startDate: '2019/08' })
    const issues = checkConsistency(doc)
    const issue = find(issues, 'consistency.dateFormat')
    expect(issue?.severity).toBe('warn')
    expect(issue?.points).toBe(4)
    expect(issue?.params?.sample).toBe('2019/08')
    expect(Number(issue?.params?.count)).toBe(1)
    expect(issue?.target?.entryId).toBe('exp-2')
    expect(find(issues, 'consistency.summary')).toBeUndefined()
  })

  it('casingOf memetakan tiap gaya penulisan termasuk label tanpa huruf', () => {
    expect(casingOf('PENGALAMAN')).toBe('upper')
    expect(casingOf('Pengalaman Kerja')).toBe('title')
    expect(casingOf('keahlian')).toBe('lower')
    expect(casingOf('Pengalaman kerja')).toBe('mixed')
    expect(casingOf('123')).toBe('mixed')
  })

  it('label registry selalu seragam & kanonis → cabang defensif tidak pernah lahir', () => {
    const kinds = Object.keys(sectionRegistry) as SectionKind[]
    const titles = new Set(kinds.map((kind) => casingOf(t(sectionRegistry[kind].labelId))))
    expect(titles.size).toBe(1)
    for (const kind of kinds) {
      expect(isCanonicalHeading(kind, t(sectionRegistry[kind].labelId))).toBe(true)
    }
    const visible = sampleResume().sections.map((section) => ({ ...section, visible: true }))
    expect(
      checkSections({ ...sampleResume(), sections: visible }).filter(
        (issue) => issue.ruleId === 'sections.heading',
      ),
    ).toEqual([])
    expect(find(checkConsistency(sampleResume()), 'consistency.headingCasing')).toBeUndefined()
  })
})

describe('sections.ts — bagian inti hilang total', () => {
  it('bagian summary tidak ada sama sekali → target kosong, saran menambahkan bagian', () => {
    const issues = checkSections(onlySections(['profile', 'experience', 'education', 'skills']))
    const missing = find(issues, 'sections.summary.missing')
    expect(missing?.severity).toBe('warn')
    expect(missing?.target).toBeUndefined()
    expect(missing?.fixHintId).toBe('ats.fix.addSection')
    expect(missing?.params?.section).toBe(t('section.summary'))
    expect(find(issues, 'sections.summary.ok')).toBeUndefined()
  })

  it('pengalaman hilang total → bad dengan bobot penuh', () => {
    const issues = checkSections(onlySections(['profile', 'summary', 'education', 'skills']))
    const missing = find(issues, 'sections.experience.missing')
    expect(missing?.severity).toBe('bad')
    expect(missing?.points).toBe(12)
    expect(missing?.target).toBeUndefined()
    expect(missing?.fixHintId).toBe('ats.fix.addSection')
  })

  it('pengalaman disembunyikan → bad dengan target bagian (bukan tambah bagian)', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section) =>
        section.kind === 'experience' ? { ...section, visible: false } : section,
      ),
    }
    const missing = find(checkSections(doc), 'sections.experience.missing')
    expect(missing?.target?.sectionId).toBe(SAMPLE_IDS.experience)
    expect(missing?.fixHintId).toBe('ats.fix.showSection')
  })
})

describe('verbs.ts — teks pinggir', () => {
  it('string kosong / whitespace bukan kata kerja aksi dan bukan pasif', () => {
    expect(startsWithActionVerb('')).toBe(false)
    expect(startsWithActionVerb('    ')).toBe(false)
    expect(startsWithActionVerb('  Menguji regresi otomatis')).toBe(true)
    expect(startsWithPassive('')).toBe(false)
    expect(startsWithPassive('Bertanggung jawab atas tim rekayasa')).toBe(true)
    expect(startsWithPassive('Duties included maintenance')).toBe(true)
    expect(startsWithPassive('Membangun layanan rekonsiliasi')).toBe(false)
    expect(startsWithPassive('Tugas pokok harian')).toBe(true)
    expect(isActionVerb('mengoOrdinasi')).toBe(true)
    expect(isActionVerb('dipimpin')).toBe(false)
    // Daftar inti `lib/text.ts` + tambahan checker harus menutupi pembuka
    // berbahasa Inggris yang dipakai fixture sampel sendiri.
    expect(startsWithActionVerb('Led migration of a monolithic checkout flow')).toBe(true)
    expect(startsWithActionVerb('Built an inventory reconciliation service')).toBe(true)
    expect(startsWithActionVerb('Bertanggung jawab atas tim')).toBe(false)
  })
})

describe('batas dokumen', () => {
  it('bullet maksimum tetap terukur panjangnya (dipakai aturan length)', () => {
    expect(DOC_LIMITS.jobDescriptionChars).toBe(8000)
    expect(bulletOf(500)).toHaveLength(500)
    expect(bulletOf(40)).toHaveLength(40)
  })
})
