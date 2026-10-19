import { describe, expect, it } from 'vitest'
import { checkContact, phoneDigits } from '@/features/ats/rules/contact'
import { checkSections } from '@/features/ats/rules/sections'
import { checkBullets } from '@/features/ats/rules/bullets'
import { checkDates, monthsOfExperience } from '@/features/ats/rules/dates'
import { checkLength } from '@/features/ats/rules/length'
import { checkForbidden } from '@/features/ats/rules/forbidden'
import { checkConsistency, headingCasingIssue } from '@/features/ats/rules/consistency'
import { extractKeywords, matchKeywords } from '@/features/ats/rules/keywords'
import { buildReport } from '@/features/ats/engine'
import { isCanonicalHeading } from '@/features/ats/rules/headings'
import { isMachineLegible } from '@/features/ats/parseTape'
import { SAMPLE_IDS, sampleResume } from '../fixtures/sampleResume'
import {
  JOB_DESCRIPTION,
  JOB_DESCRIPTION_MATCHED,
  JOB_DESCRIPTION_MISSING,
} from '../fixtures/jobDescription'
import type { ExperienceEntry, ResumeDoc, SectionInstance } from '@/types/resume'

const issueWith = (issues: ReturnType<typeof checkContact>, id: string) =>
  issues.find((issue) => issue.id === id)

/** Ganti entri pengalaman pertama; `mutate` mengembalikan patch yang di-spread. */
function withExperience(
  doc: ResumeDoc,
  mutate: (entry: ExperienceEntry) => Partial<ExperienceEntry>,
): ResumeDoc {
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance => {
      if (section.id !== SAMPLE_IDS.experience || section.kind !== 'experience') return section
      const [first, ...rest] = section.data.entries
      if (!first) return section
      return {
        ...section,
        data: { entries: [{ ...first, ...mutate(first) }, ...rest] },
      } as SectionInstance
    }),
  }
}

const profileOf = (doc: ResumeDoc): ResumeDoc => ({
  ...doc,
  sections: doc.sections.map((section): SectionInstance => {
    if (section.id !== SAMPLE_IDS.profile || section.kind !== 'profile') return section
    return {
      ...section,
      data: { ...section.data, email: '', phone: '', location: '', links: [] },
    } as SectionInstance
  }),
})

const hideSection = (doc: ResumeDoc, id: string): ResumeDoc => ({
  ...doc,
  sections: doc.sections.map((section) =>
    section.id === id ? { ...section, visible: false } : section,
  ),
})

describe('contact.ts', () => {
  it('[lolos] email valid + telepon ≥ 8 digit → dua isu ok, tanpa bad', () => {
    const issues = checkContact(sampleResume())
    expect(issueWith(issues, 'contact.email.ok')).toBeDefined()
    expect(issueWith(issues, 'contact.phone.ok')).toBeDefined()
    expect(issues.some((issue) => issue.severity === 'bad')).toBe(false)
  })

  it('[advisory] lokasi kosong → warn, tautan kosong → info, skor tetap terjaga', () => {
    const issues = checkContact(profileOf(sampleResume()))
    expect(issueWith(issues, 'contact.phone.short')).toBeDefined()
    expect(issueWith(issues, 'contact.phone.short')?.severity).toBe('bad')
    expect(issueWith(issues, 'contact.location.missing')?.severity).toBe('warn')
    expect(issueWith(issues, 'contact.links.none')?.severity).toBe('info')
  })

  it('[blocking] email tidak berbentuk alamat → bad dengan target field email', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance =>
        section.id === SAMPLE_IDS.profile && section.kind === 'profile'
          ? { ...section, data: { ...section.data, email: 'bukan-email' } }
          : section,
      ),
    }
    const issue = issueWith(checkContact(doc), 'contact.email.invalid')
    expect(issue?.severity).toBe('bad')
    expect(issue?.target?.field).toBe('profile-email')
    expect(phoneDigits('+62 812 3456 7890')).toBe(13)
    expect(phoneDigits('12345')).toBe(5)
  })
})

describe('sections.ts', () => {
  it('[lolos] seluruh bagian inti terlihat → semua ok', () => {
    const issues = checkSections(sampleResume())
    expect(issues.every((issue) => issue.severity === 'ok')).toBe(true)
  })

  it('[advisory] summary disembunyikan → warn, bukan bad', () => {
    const issues = checkSections(hideSection(sampleResume(), SAMPLE_IDS.summary))
    const issue = issueWith(issues, 'sections.summary.missing')
    expect(issue?.severity).toBe('warn')
    expect(issue?.fixHintId).toBe('ats.fix.showSection')
  })

  it('[blocking] pengalaman disembunyikan → bad', () => {
    const issues = checkSections(hideSection(sampleResume(), SAMPLE_IDS.experience))
    expect(issueWith(issues, 'sections.experience.missing')?.severity).toBe('bad')
  })

  it('judul non-kanonis → warn, judul baku → tidak ada isu', () => {
    expect(isCanonicalHeading('experience', 'Pengalaman')).toBe(true)
    expect(isCanonicalHeading('experience', 'Work History')).toBe(true)
    expect(isCanonicalHeading('experience', 'Cerita Hidupku')).toBe(false)
  })
})

describe('bullets.ts', () => {
  it('[lolos] semua bullet 40–180 karakter → ringkasan ideal', () => {
    const issues = checkBullets(sampleResume())
    const summary = issueWith(issues, 'bullets.summary')
    expect(summary?.params?.ideal).toBe(6)
    expect(summary?.params?.total).toBe(6)
    expect(issues.filter((issue) => issue.ruleId === 'bullets.length')).toHaveLength(0)
  })

  it('[advisory] bullet 33 karakter → warn (< 40, bukan bad)', () => {
    const doc = withExperience(sampleResume(), () => ({
      bullets: ['Membangun halaman donasi terbaru'],
    }))
    const issue = issueWith(checkBullets(doc), 'bullets.exp-1.0.short')
    expect(issue?.severity).toBe('warn')
    expect(issue?.target?.field).toBe('exp-exp-1-bullet-0')
  })

  it('[blocking] bullet 10 karakter → bad; tanpa angka → info; pasif → warn', () => {
    const doc = withExperience(sampleResume(), () => ({
      bullets: [
        'Bertugas',
        'Bertanggung jawab atas pembayaran dan validasi transaksi harian pada seluruh cabang.',
      ],
    }))
    const issues = checkBullets(doc)
    expect(issueWith(issues, 'bullets.exp-1.0.tooShort')?.severity).toBe('bad')
    expect(issueWith(issues, 'bullets.exp-1.0.metric')?.severity).toBe('info')
    expect(issueWith(issues, 'bullets.exp-1.1.passive')?.severity).toBe('warn')
  })

  it('[blocking] bullet 240 karakter → bad', () => {
    const doc = withExperience(sampleResume(), () => ({ bullets: ['a'.repeat(240)] }))
    expect(issueWith(checkBullets(doc), 'bullets.exp-1.0.tooLong')?.severity).toBe('bad')
  })
})

describe('dates.ts', () => {
  it('[lolos] rentang terisi dan urut terbaru dulu → hanya ringkasan ok', () => {
    const issues = checkDates(sampleResume())
    expect(issueWith(issues, 'dates.summary')).toBeDefined()
    expect(issues.some((issue) => issue.severity === 'bad')).toBe(false)
    expect(monthsOfExperience(sampleResume())).toBeGreaterThan(36)
  })

  it('[advisory] urutan pengalaman terbalik → warn', () => {
    const doc = withExperience(sampleResume(), () => ({
      startDate: '2010-01',
      endDate: '2012-01',
      current: false,
    }))
    const issue = issueWith(checkDates(doc), 'dates.experience.order')
    expect(issue?.severity).toBe('warn')
  })

  it('[blocking] tanggal mulai & selesai kosong → dua bad', () => {
    const doc = withExperience(sampleResume(), () => ({
      startDate: '',
      endDate: '',
      current: false,
    }))
    const issues = checkDates(doc)
    expect(issueWith(issues, 'dates.exp-1.start')?.severity).toBe('bad')
    expect(issueWith(issues, 'dates.exp-1.end')?.severity).toBe('bad')
  })

  it('[blocking] tanggal selesai lebih awal dari mulai → bad terbalik', () => {
    const doc = withExperience(sampleResume(), () => ({ startDate: '2022-04', endDate: '2020-01' }))
    expect(issueWith(checkDates(doc), 'dates.exp-1.inverted')?.severity).toBe('bad')
  })

  it('[advisory] celah > 6 bulan tanpa entri → info', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance => {
        if (section.kind !== 'experience' || !('entries' in section.data)) return section
        return {
          ...section,
          data: {
            entries: [
              {
                ...section.data.entries[0]!,
                id: 'exp-gap-1',
                startDate: '2010-01',
                endDate: '2010-12',
                current: false,
              },
              {
                ...section.data.entries[1]!,
                id: 'exp-gap-2',
                startDate: '2013-01',
                endDate: '2013-12',
                current: false,
              },
            ],
          },
        } as SectionInstance
      }),
    }
    expect(issueWith(checkDates(doc), 'dates.experience.gap')?.severity).toBe('info')
  })

  it('proyek tanpa tanggal selesai tidak dianggap kurangi tanggal (tanggal tunggal)', () => {
    const issues = checkDates(sampleResume())
    expect(issues.some((issue) => issue.id === 'dates.proj-1.end')).toBe(false)
  })
})

describe('length.ts', () => {
  it('[lolos] 1 halaman, pengalaman > 3 tahun → ok', () => {
    const [issue] = checkLength(sampleResume(), 1)
    expect(issue?.severity).toBe('ok')
  })

  it('[advisory] 2 halaman untuk < 3 tahun → warn', () => {
    const doc = withExperience(sampleResume(), () => ({
      startDate: '2024-01',
      endDate: '',
      current: true,
    }))
    const short: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section): SectionInstance =>
        section.kind === 'experience' && 'entries' in section.data
          ? { ...section, data: { entries: [{ ...section.data.entries[1]!, id: 'exp-2' }] } }
          : section,
      ),
    }
    const [issue] = checkLength(short, 2)
    expect(issue?.severity).toBe('warn')
    expect(issue?.id).toBe('length.overLimit')
  })

  it('[blocking] 4 halaman → warn apa pun pengalamannya', () => {
    const [issue] = checkLength(sampleResume(), 4)
    expect(issue?.severity).toBe('warn')
    expect(issue?.id).toBe('length.tooManyPages')
  })
})

describe('forbidden.ts', () => {
  it('[lolos] template hitam-putih tanpa level angka → ok', () => {
    const issues = checkForbidden(sampleResume())
    expect(issueWith(issues, 'forbidden.summary')?.severity).toBe('ok')
  })

  it('[advisory] keahlian bernilai angka → warn', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      sections: sampleResume().sections.map((section): SectionInstance => {
        if (section.kind !== 'skills') return section
        return {
          ...section,
          data: {
            groups: [{ id: 'skill-rated', name: 'Bahasa', items: ['TypeScript 90%', 'SQL 5/5'] }],
          },
        } as SectionInstance
      }),
    }
    const issue = issueWith(checkForbidden(doc), 'forbidden.skillLevel.skill-rated')
    expect(issue?.severity).toBe('warn')
    expect(issue?.target?.field).toBe('skill-group-skill-rated-items')
  })

  it('[blocking] aksen kontras rendah + template belum teruji → dua bad', () => {
    const doc: ResumeDoc = {
      ...sampleResume(),
      templateId: 'accent-gradient' as ResumeDoc['templateId'],
      theme: { accentHex: '#F2D600', fontScale: 1 },
    }
    const issues = checkForbidden(doc)
    expect(issueWith(issues, 'forbidden.accentContrast')?.severity).toBe('bad')
    expect(issueWith(issues, 'forbidden.template')?.severity).toBe('bad')
  })
})

describe('consistency.ts', () => {
  it('[lolos] format seragam → hanya ringkasan ok, tanpa warn/info/bad', () => {
    const issues = checkConsistency(sampleResume())
    expect(issues.filter((issue) => issue.severity !== 'ok')).toEqual([])
    expect(issueWith(issues, 'consistency.summary')).toBeDefined()
  })

  it('[advisory] judul bagian campur gaya penulisan → info', () => {
    const issue = headingCasingIssue(['PENGALAMAN', 'Pengalaman', 'keahlian'])
    expect(issue?.id).toBe('consistency.headingCasing')
    expect(issue?.severity).toBe('info')
    expect(headingCasingIssue(['PENGALAMAN', 'KEAHLIAN'])).toBeNull()
  })

  it('[advisory] bullet campur tanda titik → info', () => {
    const doc = withExperience(sampleResume(), () => ({
      bullets: ['Membangun layanan baru.', 'Menguji regresi otomatis'],
    }))
    const issue = issueWith(checkConsistency(doc), 'consistency.bulletPunctuation')
    expect(issue?.severity).toBe('info')
    const params = issue?.params ?? {}
    expect(Number(params.withPeriod)).toBeGreaterThan(0)
    expect(Number(params.withoutPeriod)).toBeGreaterThan(0)
  })
})

describe('keywords.ts', () => {
  it('[lolos] lowongan cocok sebagian → matched & missing terisi, density 0–1', () => {
    const doc: ResumeDoc = { ...sampleResume(), jobDescription: JOB_DESCRIPTION }
    const result = matchKeywords(doc)
    expect(result).not.toBeNull()
    expect(result!.matched).toEqual(expect.arrayContaining(JOB_DESCRIPTION_MATCHED))
    expect(result!.missing).toEqual(expect.arrayContaining(JOB_DESCRIPTION_MISSING))
    expect(result!.density).toBeGreaterThan(0)
    expect(result!.density).toBeLessThanOrEqual(1)
  })

  it('[advisory] frasa multi-kata tetap jadi satu istilah', () => {
    const { terms } = extractKeywords(
      'Pengalaman dengan code review dan code review rutin bersama tim lintas fungsi',
    )
    expect(terms).toContain('code review')
    expect(terms.some((term) => term === 'tim')).toBe(false)
  })

  it('[blocking] tanpa deskripsi lowongan → null (highlighter mati)', () => {
    expect(matchKeywords(sampleResume())).toBeNull()
    expect(matchKeywords({ ...sampleResume(), jobDescription: '   ' })).toBeNull()
    expect(buildReport(sampleResume(), 1, 0).keywords).toBeNull()
  })
})

describe('parse tape vs kelayakan mesin', () => {
  it('[lolos] huruf, angka, dan tanda baca dokumen tetap terbaca mesin', () => {
    expect(isMachineLegible('Led migration of a monolithic checkout flow — 1.8s ke 420 ms.')).toBe(
      true,
    )
    expect(isMachineLegible('alex.morgan@mail.com · +62 812 3456 7890 (Jakarta) 100%')).toBe(true)
  })

  it('[blocking] emoji/glif hias ditandai UNCLAIMED', () => {
    expect(isMachineLegible('Kreator konten ✨🔥')).toBe(false)
    expect(isMachineLegible('ab')).toBe(false)
  })
})
