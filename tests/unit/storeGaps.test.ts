import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { buildReport } from '@/features/ats/engine'
import {
  createEmptyDoc,
  createEmptyEntry,
  createEmptyProfile,
  createSampleDoc,
  DOC_LIMITS,
  SECTION_ORDER,
} from '@/schema/resume'
import { scheduleHeight, usePreviewStore, useSettledHeights } from '@/store/previewStore'
import { useAtsStore } from '@/store/atsStore'
import { useDocStore, type DocStore } from '@/store/docStore'
import { useErrorStore } from '@/store/errorStore'
import { usePdfExportStore } from '@/store/pdfExportStore'
import { useUiStore } from '@/store/uiStore'
import type { ProfileData, ResumeDoc, SectionInstance } from '@/types/resume'

/**
 * T9.1 — penutup cabang `src/store/*` plus pembuktian IMMUTABILITY: setiap aksi
 * docStore membuat objek dokumen baru dan tidak pernah mengubah dokumen lama.
 * Pembuktian dilakukan dua cara: objek lama dibekukan dalam (akan melempar
 * TypeError bila ada tulis in-place) dan sidik jari JSON-nya dibandingkan.
 */

const store = (): DocStore => useDocStore.getState()

const sectionOf = (doc: ResumeDoc, kind: SectionInstance['kind']): SectionInstance => {
  const found = doc.sections.find((section) => section.kind === kind)
  if (!found) throw new Error(`fixture tanpa bagian ${kind}`)
  return found
}

const entriesOf = (doc: ResumeDoc, kind: SectionInstance['kind']): { id: string }[] => {
  const section = sectionOf(doc, kind)
  if (!('entries' in section.data)) throw new Error(`bagian ${kind} tidak punya entries`)
  return section.data.entries as { id: string }[]
}

const entryIds = (doc: ResumeDoc, kind: SectionInstance['kind']): string[] =>
  entriesOf(doc, kind).map((entry) => entry.id)

const withEntriesCount = (doc: ResumeDoc, count: number): ResumeDoc => {
  const experience = sectionOf(doc, 'experience')
  const entries = Array.from({ length: count }, (_, index) => ({
    ...createEmptyEntry('experience'),
    id: `exp-${index}`,
    company: `PT ${index}`,
  }))
  return {
    ...doc,
    sections: doc.sections.map((section): SectionInstance =>
      section.id === experience.id
        ? ({ ...section, data: { entries } } as SectionInstance)
        : section,
    ),
  }
}

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

let clock = 1_700_000_000_000

beforeEach(() => {
  clock = 1_700_000_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => ++clock)
  store().loadDoc(createSampleDoc())
})

describe('docStore — immutability & meta.updatedAt (T9.1)', () => {
  type LoopAction = {
    name: string
    prepare?: () => void
    touchesSections?: boolean
    run: () => void
  }

  const actions: LoopAction[] = [
    { name: 'setTitle', run: () => store().setTitle('Judul Baru') },
    { name: 'setTemplate', run: () => store().setTemplate('ledger') },
    { name: 'setPageSettings', run: () => store().setPageSettings({ marginMm: 22 }) },
    { name: 'setThemeTokens', run: () => store().setThemeTokens({ accentHex: '#FF6E00' }) },
    { name: 'setJobDescription(text)', run: () => store().setJobDescription('Lowongan baru') },
    {
      name: 'setJobDescription(null)',
      prepare: () => store().setJobDescription('Isi lama'),
      run: () => store().setJobDescription(null),
    },
    { name: 'setLastCheckedAt(number)', run: () => store().setLastCheckedAt(1699999999999) },
    {
      name: 'setLastCheckedAt(null)',
      prepare: () => store().setLastCheckedAt(1699999999999),
      run: () => store().setLastCheckedAt(null),
    },
    {
      name: 'toggleSectionVisible',
      touchesSections: true,
      run: () => store().toggleSectionVisible(sectionOf(store().doc, 'profile').id),
    },
    { name: 'addSection', touchesSections: true, run: () => store().addSection('awards') },
    {
      name: 'duplicateSection',
      touchesSections: true,
      run: () => store().duplicateSection(sectionOf(store().doc, 'projects').id),
    },
    {
      name: 'removeSection',
      touchesSections: true,
      run: () => store().removeSection(sectionOf(store().doc, 'certifications').id),
    },
    { name: 'reorderSection', touchesSections: true, run: () => store().reorderSection(0, 4) },
    {
      name: 'addEntry',
      touchesSections: true,
      run: () => store().addEntry(sectionOf(store().doc, 'experience').id),
    },
    {
      name: 'duplicateEntry',
      touchesSections: true,
      run: () =>
        store().duplicateEntry(
          sectionOf(store().doc, 'experience').id,
          entryIds(store().doc, 'experience')[0]!,
        ),
    },
    {
      name: 'removeEntry',
      touchesSections: true,
      run: () =>
        store().removeEntry(
          sectionOf(store().doc, 'experience').id,
          entryIds(store().doc, 'experience')[0]!,
        ),
    },
    {
      name: 'reorderEntry',
      touchesSections: true,
      run: () => store().reorderEntry(sectionOf(store().doc, 'experience').id, 0, 1),
    },
    {
      name: 'updateSection',
      touchesSections: true,
      run: () =>
        store().updateSection(sectionOf(store().doc, 'summary').id, (data) => ({
          ...(data as { text: string }),
          text: 'Ringkasan baru',
        })),
    },
    {
      name: 'updateEntry',
      touchesSections: true,
      run: () =>
        store().updateEntry(
          sectionOf(store().doc, 'experience').id,
          entryIds(store().doc, 'experience')[0]!,
          (entry) => ({ ...entry, role: 'QA Engineer' }),
        ),
    },
    {
      name: 'resetDoc',
      touchesSections: true,
      run: () => store().resetDoc(createEmptyDoc()),
    },
  ]

  for (const action of actions) {
    it(`${action.name}: dokumen lama beku & tetap utuh, objek baru, updatedAt naik`, () => {
      action.prepare?.()
      const prevDoc = deepFreeze(structuredClone(store().doc))
      store().loadDoc(prevDoc)
      const prevSections = prevDoc.sections
      const prevMeta = prevDoc.meta
      const prevUpdatedAt = prevDoc.meta.updatedAt
      const fingerprint = JSON.stringify(prevDoc)

      expect(() => action.run()).not.toThrow()

      const nextDoc = store().doc
      expect(Object.is(prevDoc, nextDoc), action.name).toBe(false)
      if (action.touchesSections === true) {
        expect(nextDoc.sections).not.toBe(prevSections)
      } else {
        // Aksi tingkat dokumen tidak menyentuh isi bagian: array sumber dipakai
        // kembali, dan justru itulah yang membuktikan tidak ada salinan liar.
        expect(nextDoc.sections).toBe(prevSections)
      }
      expect(prevDoc.sections).toBe(prevSections)
      expect(prevDoc.meta).toBe(prevMeta)
      expect(JSON.stringify(prevDoc)).toBe(fingerprint)
      expect(nextDoc.meta.updatedAt).toBeGreaterThan(prevUpdatedAt)
      // `resetDoc` sengaja membawa dokumen baru lengkap dengan createdAt-nya.
      if (action.name !== 'resetDoc') {
        expect(nextDoc.meta.createdAt).toBe(prevDoc.meta.createdAt)
      }
    })
  }

  it('bagian yang tidak disentuh tetap identik secara referensi', () => {
    const doc = store().doc
    const education = sectionOf(doc, 'education')
    const languages = sectionOf(doc, 'languages')

    store().setTitle('Hanya judul')

    const next = store().doc
    expect(next.sections.find((section) => section.id === education.id)).toBe(education)
    expect(next.sections.find((section) => section.id === languages.id)).toBe(languages)
    expect(next.sections.length).toBe(doc.sections.length)
  })

  it('updateEntry hanya membuat ulang entri yang dituju', () => {
    const doc = store().doc
    const experience = sectionOf(doc, 'experience')
    const [first, second] = entriesOf(doc, 'experience') as [
      { id: string; role?: string },
      { id: string; role?: string },
    ]
    if (!first || !second) throw new Error('fixture butuh 2 entri pengalaman')

    store().updateEntry(experience.id, first.id, (entry) => ({ ...entry, role: 'Lead' }))

    const next = sectionOf(store().doc, 'experience').data as {
      entries: { id: string; role: string }[]
    }
    expect(next.entries[0]?.id).toBe(first.id)
    expect(next.entries[0]?.role).toBe('Lead')
    expect(next.entries[1]).toBe(second)
    expect(experience.data).not.toBe(next)
  })
})

describe('docStore — commit & riwayat', () => {
  it('commit tanpa options selalu menambah history', () => {
    const before = store().history.length
    store().commit((doc) => ({ ...doc, title: `A${before}` }))
    expect(store().history).toHaveLength(before + 1)
    store().commit((doc) => ({ ...doc, title: `B${before}` }))
    expect(store().history).toHaveLength(before + 2)
  })

  it('commit({coalesce:true}) dalam 150ms tidak menambah history', () => {
    const before = store().history.length
    const summaryId = sectionOf(store().doc, 'summary').id
    store().updateSection(summaryId, (data) => ({ ...(data as { text: string }), text: 'satu' }))
    expect(store().history).toHaveLength(before + 1)

    clock += 100
    store().updateSection(summaryId, (data) => ({ ...(data as { text: string }), text: 'dua' }))

    expect(store().history).toHaveLength(before + 1)
    expect(store().doc.title).toBe('CV Alex Morgan — Software Engineer')
    expect(sectionOf(store().doc, 'summary').data).toEqual({ text: 'dua' })
  })

  it('commit({coalesce:true}) lewat 150ms menambah entri history baru', () => {
    const before = store().history.length
    const experienceId = sectionOf(store().doc, 'experience').id
    const firstId = entryIds(store().doc, 'experience')[0]!
    store().updateEntry(experienceId, firstId, (entry) => ({ ...entry, role: 'Awal' }))

    clock += 400
    store().updateEntry(experienceId, firstId, (entry) => ({ ...entry, role: 'Lagi' }))

    expect(store().history).toHaveLength(before + 2)
  })

  it('commit non-coalesce di tengah burst me-reset jendela coalesce', () => {
    const before = store().history.length
    const summaryId = sectionOf(store().doc, 'summary').id
    store().updateSection(summaryId, (data) => ({ ...(data as { text: string }), text: 'a' }))
    store().commit((doc) => ({ ...doc, title: 'Sela' }), { coalesce: false })
    store().updateSection(summaryId, (data) => ({ ...(data as { text: string }), text: 'b' }))
    expect(store().history).toHaveLength(before + 3)
  })

  it('commit yang mengembalikan dokumen identik tidak mengubah state sama sekali', () => {
    const doc = store().doc
    const history = store().history
    store().commit((current) => current)
    expect(store().doc).toBe(doc)
    expect(store().history).toBe(history)
  })

  it('history dibatasi 50 entri paling baru', () => {
    for (let index = 0; index < 60; index += 1) {
      store().setTitle(`T${index}`)
    }
    expect(store().history).toHaveLength(50)
    expect(store().history[0]?.title).toBe('T9')
    expect(store().history.at(-1)?.title).toBe('T58')
    expect(store().doc.title).toBe('T59')
  })

  it('setActiveSection adalah navigasi: tanpa history dan tanpa updatedAt baru', () => {
    const doc = store().doc
    const history = store().history.length
    const target = sectionOf(doc, 'education').id

    store().setActiveSection(target)

    expect(store().activeSectionId).toBe(target)
    expect(store().history).toHaveLength(history)
    expect(store().doc).toBe(doc)
    expect(store().doc.meta.updatedAt).toBe(doc.meta.updatedAt)
  })
})

describe('docStore — batas indeks move', () => {
  it('reorderSection menolak dari<0, dari>=panjang, to<0, to>=panjang, dari===to', () => {
    const doc = store().doc
    const ids = doc.sections.map((section) => section.id)
    const history = store().history.length
    const last = ids.length - 1

    store().reorderSection(-1, 0)
    store().reorderSection(last + 1, 0)
    store().reorderSection(0, -1)
    store().reorderSection(0, last + 1)
    store().reorderSection(2, 2)

    expect(store().doc).toBe(doc)
    expect(store().doc.sections.map((section) => section.id)).toEqual(ids)
    expect(store().history).toHaveLength(history)
  })

  it('reorderSection memindahkan satu posisi dan membuat array baru', () => {
    const doc = store().doc
    const ids = doc.sections.map((section) => section.id)

    store().reorderSection(0, 2)

    expect(store().doc.sections.map((section) => section.id)).toEqual([
      ids[1],
      ids[2],
      ids[0],
      ...ids.slice(3),
    ])
    expect(store().doc).not.toBe(doc)
    expect(store().doc.sections).not.toBe(doc.sections)
  })

  it('TEMUAN T9.1: reorderEntry di luar batas tetap membuat dokumen & history baru', () => {
    const doc = store().doc
    const sectionId = sectionOf(doc, 'experience').id
    const history = store().history.length

    store().reorderEntry(sectionId, 5, 0)
    store().reorderEntry(sectionId, 0, 5)
    store().reorderEntry(sectionId, 0, 0)

    expect(entryIds(store().doc, 'experience')).toEqual(entryIds(doc, 'experience'))
    // `move` mengembalikan array asal, tetapi `withEntries` selalu membuat salinan
    // dokumen baru; tidak seperti reorderSection, aksi ini tanpa guard no-op.
    expect(store().doc).not.toBe(doc)
    expect(store().history).toHaveLength(history + 3)
  })

  it('reorderEntry yang valid memindahkan entri dalam bagian yang dituju', () => {
    const sectionId = sectionOf(store().doc, 'experience').id
    const before = entryIds(store().doc, 'experience')

    store().reorderEntry(sectionId, 0, 1)

    const after = entryIds(store().doc, 'experience')
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
  })

  it('TEMUAN T9.1: reorderEntry/removeEntry pada bagian tanpa entries melempar', () => {
    const doc = store().doc
    const summaryId = sectionOf(doc, 'summary').id

    expect(() => store().reorderEntry(summaryId, 0, 1)).toThrow(TypeError)
    expect(() => store().removeEntry(summaryId, 'apa-apa')).toThrow(TypeError)
    expect(store().doc).toBe(doc)
  })
})

describe('docStore — aksi bagian', () => {
  it('toggleSectionVisible bolak-balik untuk semua jenis bagian', () => {
    for (const kind of SECTION_ORDER) {
      const section = sectionOf(store().doc, kind)
      const was = section.visible
      store().toggleSectionVisible(section.id)
      expect(sectionOf(store().doc, kind).visible).toBe(!was)
      store().toggleSectionVisible(section.id)
      expect(sectionOf(store().doc, kind).visible).toBe(was)
    }
  })

  it('TEMUAN T9.1: toggleSectionVisible dengan id asing tetap committing (bukan no-op)', () => {
    const doc = store().doc
    const visibilityBefore = doc.sections.map((section) => [section.id, section.visible])
    const history = store().history.length

    store().toggleSectionVisible('id-asing')

    const next = store().doc
    // Tidak ada bagian yang berubah, tetapi `sections.map` selalu menghasilkan
    // array + dokumen baru sehingga commit menganggapnya perubahan.
    expect(next).not.toBe(doc)
    expect(store().history).toHaveLength(history + 1)
    expect(next.sections.map((section) => [section.id, section.visible])).toEqual(visibilityBefore)
    expect(next.sections.every((section, index) => section === doc.sections[index])).toBe(true)
    expect(next.meta.updatedAt).toBeGreaterThan(doc.meta.updatedAt)
  })

  it('addSection membuat bagian kosong untuk setiap kind dan menjadikannya aktif', () => {
    const startCount = store().doc.sections.length

    for (const kind of SECTION_ORDER) {
      store().addSection(kind)
      const added = store().doc.sections.at(-1)!
      expect(store().doc.sections).toHaveLength(startCount + SECTION_ORDER.indexOf(kind) + 1)
      expect(added.kind).toBe(kind)
      expect(added.visible).toBe(true)
      expect(added.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(store().activeSectionId).toBe(added.id)

      if (kind === 'profile') expect(added.data).toEqual(createEmptyProfile())
      if (kind === 'summary') expect(added.data).toEqual({ text: '' })
      if (kind === 'skills') expect(added.data).toEqual({ groups: [] })
      if ('entries' in added.data) expect(added.data.entries).toEqual([])
    }
    expect(store().doc.sections).toHaveLength(startCount + SECTION_ORDER.length)
  })

  it('duplicateSection menyalin entri dengan id baru tepat setelah sumbernya', () => {
    const source = sectionOf(store().doc, 'experience')
    const sourceIds = entryIds(store().doc, 'experience')

    store().duplicateSection(source.id)

    const sections = store().doc.sections
    const index = sections.findIndex((section) => section.id === source.id)
    const copy = sections[index + 1]!
    expect(copy.kind).toBe('experience')
    expect(copy.id).not.toBe(source.id)
    expect(copy.data).not.toBe(source.data)
    const copiedIds = (copy.data as { entries: { id: string }[] }).entries.map((e) => e.id)
    expect(copiedIds).toHaveLength(sourceIds.length)
    expect(copiedIds.filter((id) => sourceIds.includes(id))).toEqual([])
    expect(store().activeSectionId).toBe(copy.id)
  })

  it('duplicateSection memberi id baru pada grup skills', () => {
    const skills = sectionOf(store().doc, 'skills')
    const groupIds = (skills.data as { groups: { id: string }[] }).groups.map((g) => g.id)

    store().duplicateSection(skills.id)

    const index = store().doc.sections.findIndex((section) => section.id === skills.id)
    const copy = store().doc.sections[index + 1]!
    const groups = (copy.data as { groups: { id: string; name: string }[] }).groups
    expect(groups.map((group) => group.name)).toEqual(
      (skills.data as { groups: { name: string }[] }).groups.map((group) => group.name),
    )
    expect(groups.map((group) => group.id).filter((id) => groupIds.includes(id))).toEqual([])
    for (const group of groups) expect(group.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('duplicateSection pada bagian data datar menyalin tanpa mengubah sumber', () => {
    const profile = sectionOf(store().doc, 'profile')
    const summary = sectionOf(store().doc, 'summary')
    const profileData = profile.data as ProfileData

    store().duplicateSection(profile.id)
    store().duplicateSection(summary.id)

    const profiles = store().doc.sections.filter((section) => section.kind === 'profile')
    const summaries = store().doc.sections.filter((section) => section.kind === 'summary')
    expect(profiles).toHaveLength(2)
    expect(summaries).toHaveLength(2)
    expect(profiles[1]).not.toBe(profile)
    expect(profiles[1]?.data).not.toBe(profileData)
    expect(profiles[1]?.data).toEqual(profileData)
    expect(store().activeSectionId).toBe(summaries[1]?.id)
  })

  it('duplicateSection pada id asing tidak melakukan apa pun', () => {
    const doc = store().doc
    const history = store().history.length
    store().duplicateSection('id-asing')
    expect(store().doc).toBe(doc)
    expect(store().history).toHaveLength(history)
  })

  it('removeSection memindahkan fokus hanya saat bagian aktif terhapus', () => {
    const languages = sectionOf(store().doc, 'languages')
    store().setActiveSection(languages.id)

    store().removeSection(sectionOf(store().doc, 'awards').id)
    expect(store().activeSectionId).toBe(languages.id)

    store().removeSection(languages.id)
    expect(store().activeSectionId).toBe(store().doc.sections[0]!.id)
    expect(store().doc.sections.some((section) => section.kind === 'languages')).toBe(false)
  })

  it('removeSection bagian terakhir menyisakan activeSectionId kosong', () => {
    const sample = createSampleDoc()
    const only = sample.sections.find((section) => section.kind === 'summary')!
    store().loadDoc({ ...sample, sections: [only] })

    store().removeSection(only.id)

    expect(store().doc.sections).toEqual([])
    expect(store().activeSectionId).toBe('')
  })

  it('removeSection id asing adalah no-op', () => {
    const doc = store().doc
    store().removeSection('id-asing')
    expect(store().doc).toBe(doc)
  })
})

describe('docStore — aksi dokumen', () => {
  it('setTemplate hanya mengubah templateId', () => {
    const doc = store().doc

    store().setTemplate('executive')

    const next = store().doc
    expect(next.templateId).toBe('executive')
    expect(next).toEqual({ ...doc, templateId: 'executive', meta: next.meta })
    expect(next.sections).toBe(doc.sections)
    expect(next.theme).toBe(doc.theme)
    expect(next.settings).toBe(doc.settings)
  })

  it('setTemplate nilai sama dan setTitle nilai sama adalah no-op', () => {
    const doc = store().doc
    const history = store().history.length

    store().setTemplate(doc.templateId)
    store().setTitle(doc.title)

    expect(store().doc).toBe(doc)
    expect(store().history).toHaveLength(history)
  })

  it('setPageSettings menggabungkan sebagian tanpa menghapus kunci lain', () => {
    const doc = store().doc
    expect(doc.settings.page).toEqual({ size: 'A4', marginMm: 18, showPageNumbers: true })

    store().setPageSettings({ marginMm: 25 })

    expect(store().doc.settings.page).toEqual({ size: 'A4', marginMm: 25, showPageNumbers: true })
    expect(store().doc.settings.language).toBe('id')
    expect(store().doc.settings).not.toBe(doc.settings)

    store().setPageSettings({ size: 'LETTER', showPageNumbers: false })
    expect(store().doc.settings.page).toEqual({
      size: 'LETTER',
      marginMm: 25,
      showPageNumbers: false,
    })
    expect(store().doc.settings.language).toBe('id')
  })

  it('setThemeTokens menggabungkan accentHex dan fontScale secara terpisah', () => {
    store().setThemeTokens({ accentHex: '#FF6E00' })
    expect(store().doc.theme).toEqual({ accentHex: '#FF6E00', fontScale: 1 })

    store().setThemeTokens({ fontScale: 1.1 })
    expect(store().doc.theme).toEqual({ accentHex: '#FF6E00', fontScale: 1.1 })

    store().setThemeTokens({ accentHex: null })
    expect(store().doc.theme).toEqual({ accentHex: null, fontScale: 1.1 })
  })

  it('setJobDescription menyimpan, mengganti, dan menghapus (null)', () => {
    expect(store().doc.jobDescription).toBeNull()
    store().setJobDescription('Mencari insinyur frontend')
    expect(store().doc.jobDescription).toBe('Mencari insinyur frontend')

    const doc = store().doc
    store().setJobDescription('Mencari insinyur frontend')
    expect(store().doc).toBe(doc)

    store().setJobDescription(null)
    expect(store().doc.jobDescription).toBeNull()
    expect(store().doc).not.toBe(doc)
  })

  it('setLastCheckedAt mencatat waktu di meta dan bisa dinolkan', () => {
    expect(store().doc.meta.lastCheckedAt).toBeNull()
    store().setLastCheckedAt(1700000123456)
    expect(store().doc.meta.lastCheckedAt).toBe(1700000123456)

    const doc = store().doc
    store().setLastCheckedAt(1700000123456)
    expect(store().doc).toBe(doc)

    store().setLastCheckedAt(null)
    expect(store().doc.meta.lastCheckedAt).toBeNull()
    expect(store().doc.meta.createdAt).toBe(doc.meta.createdAt)
  })

  it('loadDoc mengganti dokumen, mengosongkan history, dan menyetel bagian aktif', () => {
    store().setTitle('Dibuang')
    const sample = createSampleDoc()

    store().loadDoc(sample)

    expect(store().doc).toBe(sample)
    expect(store().history).toEqual([])
    expect(store().activeSectionId).toBe(sample.sections[0]!.id)
  })

  it('loadDoc dokumen tanpa bagian menyetel activeSectionId ke string kosong', () => {
    store().addSection('awards')
    const noSections = { ...createSampleDoc(), sections: [] } as unknown as ResumeDoc

    store().loadDoc(noSections)

    expect(store().activeSectionId).toBe('')
    expect(store().doc.sections).toEqual([])
    expect(store().history).toEqual([])
  })

  it('loadDoc me-reset jendela coalesce supaya edit berikutnya tercatat', () => {
    const sample = createSampleDoc()
    store().updateSection(sectionOf(sample, 'summary').id, (data) => ({
      ...(data as { text: string }),
      text: 'a',
    }))
    store().loadDoc(sample)

    store().updateSection(sectionOf(sample, 'summary').id, (data) => ({
      ...(data as { text: string }),
      text: 'b',
    }))

    expect(store().history).toHaveLength(1)
  })

  it('resetDoc menimpa isi tetapi tetap masuk history', () => {
    const before = store().doc
    const fresh = createEmptyDoc()

    store().resetDoc(fresh)

    expect(store().doc.sections).toEqual(fresh.sections)
    expect(store().doc.id).toBe(fresh.id)
    expect(store().doc.meta.updatedAt).toBeGreaterThan(before.meta.updatedAt)
    expect(store().history.at(-1)).toEqual(before)
  })

  it('addSection lalu resetDoc menghapus bagian tambahan dari dokumen aktif', () => {
    const startCount = store().doc.sections.length
    store().addSection('awards')
    expect(store().doc.sections).toHaveLength(startCount + 1)

    store().resetDoc(createSampleDoc())

    expect(store().doc.sections).toHaveLength(startCount)
  })
})

describe('docStore — DOC_LIMITS.entriesPerSection (T9.6)', () => {
  it('addEntry berhenti di 40 entri', () => {
    store().loadDoc(withEntriesCount(createSampleDoc(), DOC_LIMITS.entriesPerSection - 1))
    const sectionId = sectionOf(store().doc, 'experience').id

    store().addEntry(sectionId)
    expect(entryIds(store().doc, 'experience')).toHaveLength(DOC_LIMITS.entriesPerSection)

    const full = store().doc
    const history = store().history.length
    store().addEntry(sectionId)
    expect(entryIds(store().doc, 'experience')).toHaveLength(DOC_LIMITS.entriesPerSection)
    expect(store().doc).toBe(full)
    expect(store().history).toHaveLength(history)
  })

  it('duplicateEntry berhenti di 40 entri', () => {
    store().loadDoc(withEntriesCount(createSampleDoc(), DOC_LIMITS.entriesPerSection))
    const sectionId = sectionOf(store().doc, 'experience').id
    const doc = store().doc
    const history = store().history.length

    store().duplicateEntry(sectionId, entryIds(store().doc, 'experience')[0]!)

    expect(entryIds(store().doc, 'experience')).toHaveLength(DOC_LIMITS.entriesPerSection)
    expect(store().doc).toBe(doc)
    expect(store().history).toHaveLength(history)
  })

  it('duplicateEntry masih bekerja tepat di bawah batas', () => {
    store().loadDoc(withEntriesCount(createSampleDoc(), DOC_LIMITS.entriesPerSection - 1))
    const sectionId = sectionOf(store().doc, 'experience').id
    const lastId = entryIds(store().doc, 'experience').at(-1)!

    store().duplicateEntry(sectionId, lastId)

    const ids = entryIds(store().doc, 'experience')
    expect(ids).toHaveLength(DOC_LIMITS.entriesPerSection)
    expect(ids.at(-2)).toBe(lastId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('addEntry/duplicateEntry pada bagian tanpa entries atau id asing diabaikan', () => {
    const doc = store().doc
    const history = store().history.length
    const summaryId = sectionOf(doc, 'summary').id
    const skillsId = sectionOf(doc, 'skills').id
    const profileId = sectionOf(doc, 'profile').id

    store().addEntry('section-asing')
    store().addEntry(summaryId)
    store().addEntry(skillsId)
    store().addEntry(profileId)
    store().duplicateEntry('section-asing', 'entri-asing')
    store().duplicateEntry(summaryId, 'entri-asing')
    store().duplicateEntry(sectionOf(doc, 'experience').id, 'entri-asing')

    expect(store().doc).toBe(doc)
    expect(store().history).toHaveLength(history)
  })

  it('removeEntry menyisakan array entri baru', () => {
    const sectionId = sectionOf(store().doc, 'experience').id
    const ids = entryIds(store().doc, 'experience')

    store().removeEntry(sectionId, ids[0]!)

    expect(entryIds(store().doc, 'experience')).toEqual(ids.slice(1))
  })
})

describe('previewStore — pengukuran tinggi (T4.2)', () => {
  const frame = (): Promise<void> =>
    new Promise((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  beforeEach(() => {
    usePreviewStore.getState().resetHeights()
  })

  it('default kosong dan resetHeights membersihkan', async () => {
    expect(usePreviewStore.getState().heights).toEqual({})

    scheduleHeight('a', 10)
    await frame()
    expect(usePreviewStore.getState().heights).toEqual({ a: 10 })

    usePreviewStore.getState().resetHeights()
    expect(usePreviewStore.getState().heights).toEqual({})
  })

  it('beberapa laporan ditampung lalu dikeluarkan sekali per frame', async () => {
    scheduleHeight('a', 10)
    scheduleHeight('b', 20)
    expect(usePreviewStore.getState().heights).toEqual({})

    await frame()

    expect(usePreviewStore.getState().heights).toEqual({ a: 10, b: 20 })
  })

  it('tinggi 0 diabaikan dan nilai sama tidak membuat objek baru', async () => {
    scheduleHeight('a', 10)
    await frame()
    const afterFirst = usePreviewStore.getState().heights

    scheduleHeight('a', 10)
    scheduleHeight('nol', 0)
    await frame()

    expect(usePreviewStore.getState().heights).toBe(afterFirst)
    expect(usePreviewStore.getState().heights).not.toHaveProperty('nol')

    scheduleHeight('a', 12)
    await frame()
    expect(usePreviewStore.getState().heights).not.toBe(afterFirst)
    expect(usePreviewStore.getState().heights.a).toBe(12)
  })

  it('satu frame dijadwalkan untuk seluruh buffer, frame baru setelah flush', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame')
    scheduleHeight('a', 1)
    scheduleHeight('b', 2)
    scheduleHeight('c', 3)
    expect(rafSpy).toHaveBeenCalledTimes(1)

    await frame()
    expect(usePreviewStore.getState().heights).toEqual({ a: 1, b: 2, c: 3 })

    rafSpy.mockClear()
    scheduleHeight('d', 4)
    expect(rafSpy).toHaveBeenCalledTimes(1)
    await frame()
    expect(usePreviewStore.getState().heights.d).toBe(4)
  })

  it('snapshot settled baru bergerak setelah debounce 60ms', async () => {
    // Dinginkan debounce tertinggal dari test sebelumnya supaya `settled`
    // sudah tersinkron dengan store ketika hook pertama kali dirender.
    await act(async () => {
      await wait(90)
    })
    const { result } = renderHook(() => useSettledHeights())
    const initial = result.current
    expect(initial).toBe(usePreviewStore.getState().heights)

    await act(async () => {
      scheduleHeight('e', 5)
      await frame()
    })
    expect(usePreviewStore.getState().heights.e).toBe(5)
    // Pemanggilan layout masih membaca snapshot lama: pemecahan halaman ditahan.
    expect(result.current).toBe(initial)

    await act(async () => {
      await wait(90)
    })
    expect(result.current).not.toBe(initial)
    expect(result.current.e).toBe(5)

    const settled = result.current
    await act(async () => {
      scheduleHeight('e', 6)
      await frame()
      await wait(20)
    })
    expect(result.current).toBe(settled)

    await act(async () => {
      await wait(90)
    })
    expect(result.current.e).toBe(6)
  })

  it('perubahan state lain bukan tinggi tidak menggerakkan settled', async () => {
    await act(async () => {
      await wait(90)
    })
    const { result } = renderHook(() => useSettledHeights())
    const settled = result.current
    expect(settled).toBe(usePreviewStore.getState().heights)

    // Tulis ulang state tanpa mengubah `heights`: langganan modul harus keluar
    // dini ( heights === settled ) sehingga tidak ada jadwal layout ulang.
    usePreviewStore.setState({})
    await act(async () => {
      await wait(90)
    })

    expect(result.current).toBe(settled)
    expect(usePreviewStore.getState().heights).toBe(settled)
  })

  it('useSettledHeights punya snapshot server (SSR) yang sama', async () => {
    await act(async () => {
      await wait(90)
    })
    const heights = usePreviewStore.getState().heights
    const { result } = renderHook(() => useSettledHeights(), { hydrate: true })

    expect(result.current).toBe(heights)
    expect(result.current).toEqual({})
  })
})

describe('store kecil — pdfExport, error, ui, ats', () => {
  it('pdfExportStore.setGenerating menyalakan dan mematikan status ekspor', () => {
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
    usePdfExportStore.getState().setGenerating(true)
    expect(usePdfExportStore.getState().isGenerating).toBe(true)
    usePdfExportStore.getState().setGenerating(false)
    expect(usePdfExportStore.getState().isGenerating).toBe(false)
  })

  it('errorStore showError/dismissError untuk kedua jenis banner', () => {
    expect(useErrorStore.getState().banner).toBeNull()
    useErrorStore.getState().showError('runtime')
    expect(useErrorStore.getState().banner).toBe('runtime')
    useErrorStore.getState().showError('quota')
    expect(useErrorStore.getState().banner).toBe('quota')
    useErrorStore.getState().dismissError()
    expect(useErrorStore.getState().banner).toBeNull()
    useErrorStore.getState().dismissError()
    expect(useErrorStore.getState().banner).toBeNull()
  })

  it('uiStore.setIncludeMarksInPdf default mati dan bisa dinyalakan (T7.5)', () => {
    expect(useUiStore.getState().includeMarksInPdf).toBe(false)
    useUiStore.getState().setIncludeMarksInPdf(true)
    expect(useUiStore.getState().includeMarksInPdf).toBe(true)
    useUiStore.getState().setIncludeMarksInPdf(false)
    expect(useUiStore.getState().includeMarksInPdf).toBe(false)
  })

  it('atsStore menyimpan hasil, status, dan kata kunci pemeriksaan', () => {
    const report = buildReport(createSampleDoc(), 2, 123)
    const ats = useAtsStore.getState()
    ats.setReport(report)
    ats.setChecking(true)
    ats.setHasOpened(true)
    ats.setLastCheckedAt(123)
    ats.setKeywords(['react', 'typescript'])

    expect(useAtsStore.getState().report).toBe(report)
    expect(useAtsStore.getState().isChecking).toBe(true)
    expect(useAtsStore.getState().hasOpened).toBe(true)
    expect(useAtsStore.getState().lastCheckedAt).toBe(123)
    expect(useAtsStore.getState().keywords).toEqual(['react', 'typescript'])

    useAtsStore.getState().setReport(null)
    useAtsStore.getState().setChecking(false)
    useAtsStore.getState().setHasOpened(false)
    useAtsStore.getState().setLastCheckedAt(null)
    useAtsStore.getState().setKeywords([])

    expect(useAtsStore.getState().report).toBeNull()
    expect(useAtsStore.getState().isChecking).toBe(false)
    expect(useAtsStore.getState().hasOpened).toBe(false)
    expect(useAtsStore.getState().lastCheckedAt).toBeNull()
    expect(useAtsStore.getState().keywords).toEqual([])
  })
})
