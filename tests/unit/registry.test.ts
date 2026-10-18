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
})
