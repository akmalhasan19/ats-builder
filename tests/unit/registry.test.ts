import { describe, expect, it } from 'vitest'
import { id } from '@/dictionaries/id'
import { SECTION_ORDER, createEmptyDoc, createSampleDoc } from '@/schema/resume'
import { sectionRegistry } from '@/features/sections/registry'

describe('sectionRegistry', () => {
  it('memiliki entri untuk semua kind dengan labelId yang ada di kamus', () => {
    for (const kind of SECTION_ORDER) {
      const entry = sectionRegistry[kind]
      expect(entry, `registry tanpa ${kind}`).toBeDefined()
      expect(entry.kind).toBe(kind)
      expect(entry.icon).toBeTruthy()
      expect(entry.requiredFields.length).toBeGreaterThan(0)
      expect(id).toHaveProperty(entry.labelId)
      expect(typeof entry.defaultData).toBe('function')
      expect(typeof entry.isComplete).toBe('function')
    }
  })

  it('defaultData menghasilkan bentuk data yang benar per kind', () => {
    expect(sectionRegistry.profile.defaultData()).toMatchObject({
      fullName: '',
      photoEnabled: false,
    })
    expect(sectionRegistry.summary.defaultData()).toEqual({ text: '' })
    expect(sectionRegistry.skills.defaultData()).toEqual({ groups: [] })
    expect(sectionRegistry.experience.defaultData()).toEqual({ entries: [] })
    expect(sectionRegistry.education.defaultData()).toEqual({ entries: [] })
    expect(sectionRegistry.projects.defaultData()).toEqual({ entries: [] })
    expect(sectionRegistry.certifications.defaultData()).toEqual({ entries: [] })
    expect(sectionRegistry.languages.defaultData()).toEqual({ entries: [] })
    expect(sectionRegistry.awards.defaultData()).toEqual({ entries: [] })
    expect(sectionRegistry.volunteering.defaultData()).toEqual({ entries: [] })
  })

  it('isComplete false untuk semua bagian kosong pada dokumen baru', () => {
    const doc = createEmptyDoc()
    for (const section of doc.sections) {
      expect(sectionRegistry[section.kind].isComplete(section.data), section.kind).toBe(false)
    }
  })

  it('isComplete membedakan bagian terisi dan kosong pada dokumen contoh', () => {
    const doc = createSampleDoc()
    const complete = [
      'profile',
      'summary',
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'languages',
    ] as const

    for (const kind of complete) {
      const section = doc.sections.find((item) => item.kind === kind)
      if (!section) throw new Error(`dokumen contoh tanpa ${kind}`)
      expect(sectionRegistry[kind].isComplete(section.data), kind).toBe(true)
    }

    for (const kind of ['awards', 'volunteering'] as const) {
      const section = doc.sections.find((item) => item.kind === kind)
      if (!section) throw new Error(`dokumen contoh tanpa ${kind}`)
      expect(sectionRegistry[kind].isComplete(section.data), kind).toBe(false)
    }
  })

  it('isComplete bernilai true untuk semua kind ketika data valid terisi', () => {
    expect(
      sectionRegistry.profile.isComplete({
        fullName: 'Budi Santoso',
        headline: 'Frontend Engineer',
        email: 'budi@example.com',
        phone: '+62812345678',
        location: 'Jakarta',
        links: [],
        photoEnabled: false,
      }),
    ).toBe(true)

    expect(sectionRegistry.summary.isComplete({ text: 'Ringkasan profesional.' })).toBe(true)

    expect(
      sectionRegistry.experience.isComplete({
        entries: [
          {
            id: '1',
            role: 'Dev',
            company: 'PT Maju',
            location: 'Jakarta',
            startDate: '2023-01',
            endDate: '',
            current: true,
            bullets: ['Membuat fitur A'],
            stack: ['React'],
          },
        ],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.education.isComplete({
        entries: [
          {
            id: '1',
            degree: 'S1',
            field: 'Informatika',
            institution: 'UI',
            location: 'Depok',
            startDate: '2019-08',
            endDate: '2023-07',
            gpa: '3.8',
            notes: [],
          },
        ],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.skills.isComplete({
        groups: [{ id: '1', name: 'Frontend', items: ['React', 'TypeScript'] }],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.projects.isComplete({
        entries: [
          {
            id: '1',
            name: 'Web Store',
            role: 'Creator',
            url: 'https://example.com',
            startDate: '2023-05',
            endDate: '',
            bullets: ['Built app'],
            stack: [],
          },
        ],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.certifications.isComplete({
        entries: [
          {
            id: '1',
            name: 'AWS Cloud',
            issuer: 'Amazon',
            issuedAt: '2023-04',
            credentialId: '123',
            url: '',
          },
        ],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.languages.isComplete({
        entries: [{ id: '1', name: 'Bahasa Indonesia', proficiency: 'Native' }],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.awards.isComplete({
        entries: [
          {
            id: '1',
            title: 'Juara 1',
            issuer: 'Kominfo',
            awardedAt: '2023-10',
            description: 'Lomba aplikasi',
          },
        ],
      }),
    ).toBe(true)

    expect(
      sectionRegistry.volunteering.isComplete({
        entries: [
          {
            id: '1',
            role: 'Pengajar',
            organization: 'Komunitas Coding',
            startDate: '2022-01',
            endDate: '',
            current: true,
            bullets: ['Mengajar dasar web'],
          },
        ],
      }),
    ).toBe(true)
  })

  it('isComplete experience menolak entri tanpa bullet atau tanpa perusahaan', () => {
    const doc = createSampleDoc()
    const section = doc.sections.find((item) => item.kind === 'experience')
    if (!section || section.kind !== 'experience') throw new Error('tanpa pengalaman')

    const entries = section.data.entries
    expect(sectionRegistry.experience.isComplete({ entries })).toBe(true)
    expect(
      sectionRegistry.experience.isComplete({ entries: [{ ...entries[0]!, company: '' }] }),
    ).toBe(false)
    expect(
      sectionRegistry.experience.isComplete({ entries: [{ ...entries[0]!, bullets: [] }] }),
    ).toBe(false)
  })

  it('getCompleteness menghitung dots dan total persentase kelengkapan', () => {
    const emptyDoc = createEmptyDoc()
    const emptyProfile = emptyDoc.sections[0]!
    const emptyResult = sectionRegistry.profile.getCompleteness(emptyProfile.data)
    expect(emptyResult.dots).toBe(0)
    expect(emptyResult.isComplete).toBe(false)

    const sampleDoc = createSampleDoc()
    const sampleProfile = sampleDoc.sections[0]!
    const sampleResult = sectionRegistry.profile.getCompleteness(sampleProfile.data)
    expect(sampleResult.dots).toBe(3)
    expect(sampleResult.isComplete).toBe(true)
  })
})
