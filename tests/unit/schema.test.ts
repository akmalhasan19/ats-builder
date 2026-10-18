import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  SECTION_ORDER,
  createEmptyDoc,
  createEmptyEntry,
  createSampleDoc,
  migrate,
  parseResumeDoc,
  resumeDocSchema,
} from '@/schema/resume'
import type { ResumeDoc, SectionInstance } from '@/types/resume'
import {
  corruptDocShapeFixture,
  corruptDocStringFixture,
  v0DocFixture,
  v0DocFullFixture,
} from '../fixtures/docs'

const messagesOf = (doc: unknown): string[] => {
  const result = resumeDocSchema.safeParse(doc)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.message)
}

const profileData = (doc: ResumeDoc) => {
  const section = doc.sections.find((item) => item.kind === 'profile')
  if (!section || section.kind !== 'profile') throw new Error('fixture tanpa profil')
  return section.data
}

describe('resumeDocSchema — validasi per field', () => {
  it('menerima dokumen contoh dan dokumen kosong apa adanya', () => {
    expect(() => parseResumeDoc(createSampleDoc())).not.toThrow()
    expect(() => parseResumeDoc(createEmptyDoc())).not.toThrow()
    expect(messagesOf(createSampleDoc())).toHaveLength(0)
  })

  it('menolak email salah dengan pesan Bahasa Indonesia yang spesifik', () => {
    const doc = createSampleDoc()
    profileData(doc).email = 'bukan-email'
    expect(messagesOf(doc)).toContain('Email belum benar. Contoh: nama@domain.com')
  })

  it('menerima email kosong (draft boleh tersimpan setengah jadi)', () => {
    const doc = createSampleDoc()
    profileData(doc).email = ''
    expect(messagesOf(doc)).toHaveLength(0)
  })

  it('menolak nomor telepon yang tidak berformat angka', () => {
    const doc = createSampleDoc()
    profileData(doc).phone = 'ozo'
    expect(messagesOf(doc)).toContain('Nomor telepon belum benar. Contoh: +62 812 3456 7890')
  })

  it('menolak tanggal yang bukan YYYY-MM dan menerima empty string', () => {
    const doc = createSampleDoc()
    const experience = doc.sections.find((item) => item.kind === 'experience')
    if (!experience || experience.kind !== 'experience') throw new Error('fixture tanpa pengalaman')

    experience.data.entries[0]!.startDate = '2024-13'
    expect(messagesOf(doc)).toContain(
      'Tanggal harus format YYYY-MM. Contoh: 2024-03 (kosong juga diperbolehkan).',
    )

    experience.data.entries[0]!.startDate = ''
    expect(messagesOf(doc)).toHaveLength(0)
  })

  it('menolak IPK di luar rentang 0.00–4.00', () => {
    const doc = createSampleDoc()
    const education = doc.sections.find((item) => item.kind === 'education')
    if (!education || education.kind !== 'education') throw new Error('fixture tanpa pendidikan')

    education.data.entries[0]!.gpa = '5.00'
    expect(messagesOf(doc)).toContain('IPK harus antara 0.00–4.00. Contoh: 3.71')
  })

  it('menolak margin di luar 5–50 mm', () => {
    const doc = createSampleDoc()
    doc.settings.page.marginMm = 100
    expect(messagesOf(doc)).toContain('Margin maksimal 50 mm.')
  })

  it('menolak fontScale di luar pilihan token', () => {
    const doc = createSampleDoc()
    doc.theme.fontScale = 1.2
    expect(() => parseResumeDoc(doc)).toThrow()
  })

  it('menolak photoEnabled = true (foto merusak parsing ATS)', () => {
    const doc = createSampleDoc()
    // @ts-expect-error sengaja di luar tipe untuk menguji runtime
    profileData(doc).photoEnabled = true
    expect(() => parseResumeDoc(doc)).toThrow()
  })

  it('menolak templateId dan proficiency di luar enum', () => {
    const doc = createSampleDoc()
    // @ts-expect-error sengaja di luar tipe untuk menguji runtime
    doc.templateId = 'modern-ribbon'
    expect(() => parseResumeDoc(doc)).toThrow()

    const other = createSampleDoc()
    const language = other.sections.find((item) => item.kind === 'languages')
    if (!language || language.kind !== 'languages') throw new Error('fixture tanpa bahasa')
    // @ts-expect-error sengaja di luar tipe untuk menguji runtime
    language.data.entries[0].proficiency = 'Expert'
    expect(() => parseResumeDoc(other)).toThrow()
  })

  it('menolak schemaVersion selain 1', () => {
    const doc = { ...createSampleDoc(), schemaVersion: 2 }
    expect(() => parseResumeDoc(doc)).toThrow()
  })
})

describe('migrate', () => {
  it('menaikkan dokumen v0 (tanpa schemaVersion) ke v1 tanpa kehilangan isi', () => {
    const doc = migrate(v0DocFixture)

    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.title).toBe('CV Versi Nol')
    expect(doc.templateId).toBe('ledger')
    expect(doc.settings.page).toEqual({ size: 'A4', marginMm: 18, showPageNumbers: true })
    expect(doc.settings.language).toBe('id')
    expect(doc.theme).toEqual({ accentHex: null, fontScale: 1 })
    expect(doc.jobDescription).toBeNull()
    expect(doc.meta.createdAt).toBeTypeOf('number')
    expect(doc.meta.updatedAt).toBe(1700000000000)
    expect(doc.meta.lastCheckedAt).toBeNull()
    expect(doc.sections).toHaveLength(1)
    expect(doc.sections[0]?.kind).toBe('summary')
    expect(doc.sections[0]).toMatchObject({ data: { text: 'Isi ringkasan dokumen lama.' } })
  })

  it('melewatkan dokumen v1 yang sudah valid tanpa perubahan', () => {
    const original = createSampleDoc()
    expect(migrate(original)).toEqual(original)
  })

  it('v0 yang sudah lengkap mempertahankan pengaturannya, tidak ditimpa default', () => {
    const doc = migrate(v0DocFullFixture)

    expect(doc.settings.page).toEqual({
      size: 'LETTER',
      marginMm: 20,
      showPageNumbers: false,
    })
    expect(doc.settings.language).toBe('en')
    expect(doc.theme).toEqual({ accentHex: '#123456', fontScale: 0.95 })
    expect(doc.jobDescription).toBe('Deskripsi lowongan lama')
    expect(doc.meta).toEqual({
      createdAt: 1600000000000,
      updatedAt: 1700000000000,
      lastCheckedAt: 1650000000000,
    })
  })

  it('menolak dokumen yang bukan objek', () => {
    expect(() => migrate(corruptDocStringFixture)).toThrow('Dokumen bukan objek.')
    expect(() => migrate(null)).toThrow('Dokumen bukan objek.')
    expect(() => migrate([1, 2, 3])).toThrow('Dokumen bukan objek.')
  })

  it('menolak dokumen dengan struktur rusak lolos parse Zod', () => {
    expect(() => migrate(corruptDocShapeFixture)).toThrow()
  })

  it('menolak dokumen dari versi skema yang lebih baru', () => {
    const future = { ...createSampleDoc(), schemaVersion: 99 }
    expect(() => migrate(future)).toThrow('lebih baru')
  })

  it('menolak versi yang tidak punya jalur migrasi', () => {
    expect(() => migrate({ schemaVersion: -1 })).toThrow('Tidak ada jalur migrasi')
  })
})

describe('factory', () => {
  it('createSampleDoc sesuai jumlah entri yang dijanjikan plan', () => {
    const doc = createSampleDoc()
    const entriesOf = (kind: SectionInstance['kind']) => {
      const section = doc.sections.find((item) => item.kind === kind)
      if (!section || !('entries' in section.data)) return null
      return section.data.entries
    }
    const skills = doc.sections.find((item) => item.kind === 'skills')

    expect(doc.sections.find((item) => item.kind === 'profile')).toBeDefined()
    expect(entriesOf('experience')).toHaveLength(2)
    expect(entriesOf('education')).toHaveLength(1)
    expect(skills?.kind === 'skills' && skills.data.groups).toHaveLength(3)
    expect(entriesOf('projects')).toHaveLength(2)
    expect(entriesOf('certifications')).toHaveLength(1)
    expect(entriesOf('languages')).toHaveLength(2)
    expect(() => parseResumeDoc(doc)).not.toThrow()
  })

  it('createEmptyDoc punya 10 bagian sesuai SECTION_ORDER, semua visible, id unik', () => {
    const doc = createEmptyDoc()
    expect(doc.sections.map((section) => section.kind)).toEqual([...SECTION_ORDER])
    expect(doc.sections.every((section) => section.visible)).toBe(true)

    const ids = doc.sections.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(() => parseResumeDoc(doc)).not.toThrow()
  })

  it('createEmptyEntry menghasilkan entri valid dan id unik untuk tiap kind ber-entries', () => {
    const kinds = [
      'experience',
      'education',
      'projects',
      'certifications',
      'languages',
      'awards',
      'volunteering',
    ] as const
    const ids: string[] = []

    for (const kind of kinds) {
      const entry = createEmptyEntry(kind)
      ids.push(entry.id)
      const doc: ResumeDoc = {
        ...createEmptyDoc(),
        sections: [
          { id: 'sec-fixture', kind, visible: true, data: { entries: [entry] } } as SectionInstance,
        ],
      }
      expect(() => parseResumeDoc(doc)).not.toThrow()
    }

    expect(new Set(ids).size).toBe(kinds.length)
  })
})
