import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDoc, createSampleDoc } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import type { ProfileData } from '@/types/resume'

const store = () => useDocStore.getState()

beforeEach(() => {
  store().loadDoc(createEmptyDoc())
})

describe('commit', () => {
  it('menaikkan meta.updatedAt pada setiap perubahan', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    store().setTitle('Dokumen Baru')

    expect(store().doc.title).toBe('Dokumen Baru')
    expect(store().doc.meta.updatedAt).toBe(1700000000000)
    expect(store().history).toHaveLength(1)
  })

  it('tidak menambah history bila updater mengembalikan dokumen yang sama', () => {
    store().setTitle('Awal')
    const historyBefore = store().history.length

    store().commit((doc) => doc)

    expect(store().history).toHaveLength(historyBefore)
  })

  it('menimbun history untuk undo Fase 11 dan membatasinya', () => {
    for (let index = 0; index < 60; index += 1) {
      store().setTitle(`Judul ${index}`)
    }
    expect(store().history).toHaveLength(50)
    expect(store().history[49]?.title).toBe('Judul 58')
  })
})

describe('aksi bagian', () => {
  it('updateSection mengganti data bagian lewat commit', () => {
    const profileId = store().doc.sections[0]!.id

    store().updateSection(profileId, (data) => ({
      ...(data as ProfileData),
      fullName: 'Contoh Nama',
    }))

    const profile = store().doc.sections[0]!
    expect(profile.kind).toBe('profile')
    expect(profile.kind === 'profile' && profile.data.fullName).toBe('Contoh Nama')
    expect(store().history).toHaveLength(1)
  })

  it('toggleSectionVisible membalik visible', () => {
    const target = store().doc.sections[1]!
    expect(target.visible).toBe(true)

    store().toggleSectionVisible(target.id)
    expect(store().doc.sections[1]!.visible).toBe(false)
  })

  it('addSection menambahkan bagian baru dan menjadikannya aktif', () => {
    const before = store().doc.sections.length

    store().addSection('projects')

    const added = store().doc.sections.at(-1)!
    expect(store().doc.sections).toHaveLength(before + 1)
    expect(added.kind).toBe('projects')
    expect(added.visible).toBe(true)
    expect(store().activeSectionId).toBe(added.id)
    expect(added.data).toEqual({ entries: [] })
  })

  it('removeSection menghapus dan memindahkan fokus bila aktif ikut terhapus', () => {
    const first = store().doc.sections[0]!
    store().removeSection(first.id)

    expect(store().doc.sections.find((section) => section.id === first.id)).toBeUndefined()
    expect(store().activeSectionId).toBe(store().doc.sections[0]!.id)

    const activeId = store().activeSectionId
    store().removeSection(activeId)
    expect(store().activeSectionId).not.toBe(activeId)
  })

  it('removeSection yang tidak ada tidak mengubah apa pun', () => {
    const before = store().history.length
    store().removeSection('tidak-ada')
    expect(store().history).toHaveLength(before)
  })

  it('reorderSection memindahkan urutan array', () => {
    const kindsBefore = store().doc.sections.map((section) => section.kind)

    store().reorderSection(0, 3)

    const kindsAfter = store().doc.sections.map((section) => section.kind)
    expect(kindsAfter[3]).toBe(kindsBefore[0])
    expect(kindsAfter[0]).toBe(kindsBefore[1])
    expect(new Set(kindsAfter)).toEqual(new Set(kindsBefore))
  })

  it('reorderSection di luar batas tidak mengubah dokumen', () => {
    const before = store().history.length
    const ids = store().doc.sections.map((section) => section.id)

    store().reorderSection(-1, 0)
    store().reorderSection(0, 999)
    store().reorderSection(0, -1)
    store().reorderSection(2, 2)

    expect(store().doc.sections.map((section) => section.id)).toEqual(ids)
    expect(store().history).toHaveLength(before)
  })

  it('aksi pada target yang tidak ada diabaikan tanpa mengubah history', () => {
    const before = store().history.length
    const experienceId = store().doc.sections.find((s) => s.kind === 'experience')!.id
    const actualId = store().doc.sections[0]!.id

    store().addEntry('section-tidak-ada')
    store().duplicateEntry('section-tidak-ada', 'entri-tidak-ada')
    store().duplicateEntry(experienceId, 'entri-tidak-ada')
    store().duplicateEntry(actualId, 'entri-tidak-ada')
    store().setTitle(store().doc.title)

    expect(store().history).toHaveLength(before)
  })

  it('setTemplate, setPageSettings, setThemeTokens hanya mengubah bagiannya', () => {
    store().setTemplate('executive')
    store().setPageSettings({ marginMm: 24 })
    store().setThemeTokens({ fontScale: 0.95 })

    expect(store().doc.templateId).toBe('executive')
    expect(store().doc.settings.page.marginMm).toBe(24)
    expect(store().doc.settings.page.size).toBe('A4')
    expect(store().doc.theme.fontScale).toBe(0.95)
    expect(store().doc.theme.accentHex).toBeNull()
  })

  it('setTemplate ke template yang sama dianggap no-op', () => {
    const before = store().history.length
    store().setTemplate(store().doc.templateId)
    expect(store().history).toHaveLength(before)
  })
})

describe('aksi entri', () => {
  const experienceIdOf = () =>
    store().doc.sections.find((section) => section.kind === 'experience')!.id

  it('addEntry menambah satu entri kosong dengan id baru', () => {
    const sectionId = experienceIdOf()

    store().addEntry(sectionId)

    const entries = store().doc.sections.find((section) => section.id === sectionId)!.data
    const list = (entries as { entries: { id: string }[] }).entries
    expect(list).toHaveLength(1)
    expect(list[0]!.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('addEntry pada bagian tanpa entries tidak menambah history', () => {
    const summaryId = store().doc.sections.find((section) => section.kind === 'summary')!.id
    const before = store().history.length

    store().addEntry(summaryId)

    expect(store().history).toHaveLength(before)
  })

  it('updateEntry mengubah entri yang dituju saja', () => {
    const sectionId = experienceIdOf()
    store().addEntry(sectionId)
    const firstId = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string }[]
      }
    ).entries[0]!.id

    store().addEntry(sectionId)
    store().updateEntry(sectionId, firstId, (entry) => ({ ...entry, role: 'QA Engineer' }))

    const list = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string; role?: string }[]
      }
    ).entries
    expect(list).toHaveLength(2)
    expect(list[0]!.role).toBe('QA Engineer')
    expect(list[1]!.role).toBe('')
  })

  it('duplicateEntry menyalin entri dengan id baru tepat setelah aslinya', () => {
    const sectionId = experienceIdOf()
    store().addEntry(sectionId)
    const originalId = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string }[]
      }
    ).entries[0]!.id
    store().updateEntry(sectionId, originalId, (entry) => ({ ...entry, company: 'PT Uji' }))

    store().duplicateEntry(sectionId, originalId)

    const list = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string; company?: string }[]
      }
    ).entries
    expect(list).toHaveLength(2)
    expect(list[0]!.id).toBe(originalId)
    expect(list[1]!.id).not.toBe(originalId)
    expect(list[1]!.company).toBe('PT Uji')
  })

  it('removeEntry menghapus entri yang dituju', () => {
    const sectionId = experienceIdOf()
    store().addEntry(sectionId)
    store().addEntry(sectionId)
    const entries = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string }[]
      }
    ).entries

    store().removeEntry(sectionId, entries[0]!.id)

    const after = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string }[]
      }
    ).entries
    expect(after).toHaveLength(1)
    expect(after[0]!.id).toBe(entries[1]!.id)
  })

  it('reorderEntry memindahkan posisi entri', () => {
    const sectionId = experienceIdOf()
    store().addEntry(sectionId)
    store().addEntry(sectionId)
    const entries = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string }[]
      }
    ).entries

    store().reorderEntry(sectionId, 0, 1)

    const after = (
      store().doc.sections.find((s) => s.id === sectionId)!.data as {
        entries: { id: string }[]
      }
    ).entries
    expect(after[0]!.id).toBe(entries[1]!.id)
    expect(after[1]!.id).toBe(entries[0]!.id)
  })
})

describe('loadDoc & resetDoc', () => {
  it('loadDoc mengganti dokumen dan mengosongkan history (hidrasi, bukan edit)', () => {
    store().setTitle('Dibuang')
    const sample = createSampleDoc()

    store().loadDoc(sample)

    expect(store().doc).toEqual(sample)
    expect(store().history).toHaveLength(0)
    expect(store().activeSectionId).toBe(sample.sections[0]!.id)
  })

  it('resetDoc lewat commit sehingga tetap ter-undo di Fase 11', () => {
    // Waktu dibekukan: commit menaikkan meta.updatedAt, dan test ini
    // membandingkan seluruh objek — tanpa ini hasilnya bergantung milidetik.
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    store().setTitle('Sebelum reset')
    const sample = createSampleDoc()

    store().resetDoc(sample)

    expect(store().doc).toEqual(sample)
    expect(store().history.at(-1)?.title).toBe('Sebelum reset')
  })
})
