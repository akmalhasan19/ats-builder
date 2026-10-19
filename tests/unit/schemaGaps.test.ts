import { describe, expect, it, vi } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  DOC_LIMITS,
  SECTION_ORDER,
  certificationSchema,
  createEmptyDoc,
  createEmptyEntry,
  createEmptyProfile,
  createEmptySectionData,
  createSampleDoc,
  linkItemSchema,
  migrate,
  parseResumeDoc,
  projectSchema,
  resumeDocSchema,
} from '@/schema/resume'
import type { ExperienceEntry, ResumeDoc, SectionInstance } from '@/types/resume'
import {
  corruptDocShapeFixture,
  corruptDocStringFixture,
  v0DocFixture,
  v0DocFullFixture,
} from '../fixtures/docs'

/**
 * T9.1 / T9.6 — penutup cabang `src/schema/resume.ts` (cabang settings.page,
 * theme.accentHex, meta, jalur default migrate) dan penegakan DOC_LIMITS.
 */

const messagesOf = (data: unknown): string[] => {
  const result = resumeDocSchema.safeParse(data)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.message)
}

const issuesOf = (data: unknown): { path: string; message: string }[] => {
  const result = resumeDocSchema.safeParse(data)
  if (result.success) return []
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}

const zodMessagesOf = (fn: () => unknown): string[] => {
  try {
    fn()
  } catch (error) {
    const issues = (error as { issues?: { message: string }[] }).issues
    if (issues) return issues.map((issue) => issue.message)
    return [(error as Error).message]
  }
  return []
}

const docWithSections = (
  sections: SectionInstance[],
  overrides: Partial<ResumeDoc> = {},
): ResumeDoc => ({ ...createEmptyDoc(), sections, ...overrides })

const summarySection = (text: string): SectionInstance => ({
  id: 'sec-summary',
  kind: 'summary',
  visible: true,
  data: { text },
})

const experienceSection = (entries: ExperienceEntry[]): SectionInstance => ({
  id: 'sec-exp',
  kind: 'experience',
  visible: true,
  data: { entries },
})

const filledBulletList = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `bullet ${index + 1}`)

const experienceEntryWithBullets = (count: number, id = 'exp-1'): ExperienceEntry => ({
  ...createEmptyEntry('experience'),
  id,
  bullets: filledBulletList(count),
})

const manyEntries = (count: number): ExperienceEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    ...createEmptyEntry('experience'),
    id: `exp-${index + 1}`,
  }))

describe('DOC_LIMITS — satu sumber batas (T9.6)', () => {
  it('nilai batas tersentuh dokumentasi UI dan validasi', () => {
    expect(DOC_LIMITS).toEqual({
      bulletsPerEntry: 60,
      entriesPerSection: 40,
      summaryChars: 1200,
      jobDescriptionChars: 8000,
    })
  })

  it('bullet: 60 lolos, 61 ditolak dengan pesan memuat angka 60', () => {
    expect(
      messagesOf(
        docWithSections([summarySection('x'), experienceSection([experienceEntryWithBullets(60)])]),
      ),
    ).toHaveLength(0)

    const messages = messagesOf(
      docWithSections([summarySection('x'), experienceSection([experienceEntryWithBullets(61)])]),
    )
    expect(messages).toContain(`Maksimal ${DOC_LIMITS.bulletsPerEntry} bullet dalam satu entri.`)
    expect(messages.join(' ')).toContain('60')
  })

  it('entri: 40 lolos, 41 ditolak dengan pesan memuat angka 40', () => {
    expect(messagesOf(docWithSections([experienceSection(manyEntries(40))]))).toHaveLength(0)

    const messages = messagesOf(docWithSections([experienceSection(manyEntries(41))]))
    expect(messages).toContain(`Maksimal ${DOC_LIMITS.entriesPerSection} entri dalam satu bagian.`)
    expect(messages.join(' ')).toContain('40')
  })

  it('grup skills memakai batas entri yang sama', () => {
    const groups = Array.from({ length: DOC_LIMITS.entriesPerSection + 1 }, (_, index) => ({
      id: `g-${index}`,
      name: `Grup ${index}`,
      items: ['react'],
    }))
    const overLimit: SectionInstance = {
      id: 'sec-skills',
      kind: 'skills',
      visible: true,
      data: { groups },
    }
    expect(messagesOf(docWithSections([overLimit]))).toContain(
      `Maksimal ${DOC_LIMITS.entriesPerSection} entri dalam satu bagian.`,
    )

    expect(
      messagesOf(
        docWithSections([
          {
            id: 'sec-skills',
            kind: 'skills',
            visible: true,
            data: { groups: groups.slice(0, DOC_LIMITS.entriesPerSection) },
          },
        ]),
      ),
    ).toHaveLength(0)
  })

  it('ringkasan: 1200 karakter lolos, 1201 ditolak', () => {
    expect(messagesOf(docWithSections([summarySection('a'.repeat(1200))]))).toHaveLength(0)
    const messages = messagesOf(docWithSections([summarySection('a'.repeat(1201))]))
    expect(messages).toContain(`Ringkasan maksimal ${DOC_LIMITS.summaryChars} karakter.`)
    expect(messages.join(' ')).toContain('1200')
  })

  it('jobDescription: 8000 lolos, 8001 ditolak, null selalu lolos', () => {
    expect(messagesOf({ ...createEmptyDoc(), jobDescription: 'b'.repeat(8000) })).toHaveLength(0)
    const messages = messagesOf({ ...createEmptyDoc(), jobDescription: 'b'.repeat(8001) })
    expect(messages).toContain(
      `Deskripsi lowongan maksimal ${DOC_LIMITS.jobDescriptionChars} karakter.`,
    )
    expect(messages.join(' ')).toContain('8000')
    expect(messagesOf({ ...createEmptyDoc(), jobDescription: null })).toHaveLength(0)
  })
})

describe('skema tautan — menolak skema berbahaya (T9.6)', () => {
  const URL_ERROR = 'Tautan harus memakai http://, https://, atau mailto:.'

  it('linkItemSchema menolak javascript: dan data:, menerima http/https/mailto', () => {
    expect(linkItemSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' }).success).toBe(false)
    expect(linkItemSchema.safeParse({ label: 'x', url: 'data:text/html,x' }).success).toBe(false)
    expect(linkItemSchema.safeParse({ label: 'x', url: 'file:///etc/passwd' }).success).toBe(false)
    expect(linkItemSchema.safeParse({ label: 'x', url: 'ftp://x' }).success).toBe(false)
    const failed = linkItemSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' })
    if (failed.success) throw new Error('harusnya gagal parse')
    expect(failed.error.issues[0]?.message).toBe(URL_ERROR)

    for (const url of ['https://x.test', 'http://x.test', 'mailto:a@b.test', 'x.test/y', '']) {
      expect(linkItemSchema.safeParse({ label: 'x', url }).success, url).toBe(true)
    }
  })

  it('projectSchema menolak javascript: pada url', () => {
    const base = {
      id: 'p-1',
      name: 'Proyek',
      role: 'Penulis',
      startDate: '2020-01',
      endDate: '',
      bullets: [],
      stack: [],
    }
    expect(projectSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false)
    expect(projectSchema.safeParse({ ...base, url: 'https://x.test' }).success).toBe(true)
  })

  it('certificationSchema menolak javascript: pada url', () => {
    const base = {
      id: 'c-1',
      name: 'AWS',
      issuer: 'Amazon',
      issuedAt: '2023-11',
      credentialId: 'X',
    }
    expect(certificationSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(
      false,
    )
    expect(certificationSchema.safeParse({ ...base, url: 'mailto:a@b.test' }).success).toBe(true)
  })

  it('dokumen utuh ikut menolak tautan berbahaya di profil', () => {
    const doc = createSampleDoc()
    const profile = doc.sections.find((section) => section.kind === 'profile')
    if (!profile || profile.kind !== 'profile') throw new Error('fixture tanpa profil')
    profile.data.links.push({ label: 'Jahat', url: 'javascript:alert(1)' })
    expect(messagesOf(doc)).toContain(URL_ERROR)
    expect(() => parseResumeDoc(doc)).toThrow()
  })

  it('parseResumeDoc menerima dokumen contoh dan dokumen kosong utuh', () => {
    expect(() => parseResumeDoc(createSampleDoc())).not.toThrow()
    expect(messagesOf(createSampleDoc())).toHaveLength(0)
    expect(messagesOf(createEmptyDoc())).toHaveLength(0)
  })
})

describe('cabang settings / theme / meta (baris 234-245, 259)', () => {
  it('page.size hanya menerima A4 atau LETTER; hilang = ditolak', () => {
    const doc = createEmptyDoc()
    // @ts-expect-error sengaja menguji enum di runtime
    doc.settings.page.size = 'LEGAL'
    expect(() => parseResumeDoc(doc)).toThrow()

    const missingSize = structuredClone(createEmptyDoc()) as ResumeDoc
    delete (missingSize.settings.page as { size?: string }).size
    expect(issuesOf(missingSize).some((issue) => issue.path === 'settings.page.size')).toBe(true)
  })

  it('marginMm dijepit 5..50 dan wajib angka', () => {
    const low = createEmptyDoc()
    low.settings.page.marginMm = 4.99
    expect(messagesOf(low)).toContain('Margin minimal 5 mm.')

    const high = createEmptyDoc()
    high.settings.page.marginMm = 50.01
    expect(messagesOf(high)).toContain('Margin maksimal 50 mm.')

    for (const margin of [5, 18, 50]) {
      const ok = createEmptyDoc()
      ok.settings.page.marginMm = margin
      expect(messagesOf(ok)).toHaveLength(0)
    }

    const notANumber = structuredClone(createEmptyDoc()) as ResumeDoc
    ;(notANumber.settings.page as unknown as { marginMm: unknown }).marginMm = '18'
    expect(() => parseResumeDoc(notANumber)).toThrow()
  })

  it('showPageNumbers wajib boolean (bukan string kosong)', () => {
    const doc = structuredClone(createEmptyDoc()) as ResumeDoc
    ;(doc.settings.page as unknown as { showPageNumbers: unknown }).showPageNumbers = ''
    expect(issuesOf(doc).some((issue) => issue.path === 'settings.page.showPageNumbers')).toBe(true)

    const off = createEmptyDoc()
    off.settings.page.showPageNumbers = false
    expect(messagesOf(off)).toHaveLength(0)
  })

  it('theme.accentHex: null, string kosong, dan hex 6 digit lolos; sisanya ditolak', () => {
    for (const accent of [null, '', '#FF6E00', '#ff6e00', '#F2D600']) {
      const doc = createEmptyDoc()
      doc.theme.accentHex = accent
      expect(messagesOf(doc), String(accent)).toHaveLength(0)
    }
    for (const accent of [
      'red',
      '#fff',
      '#0F5A7',
      '#FF6E009',
      '#0F5A7G',
      ' FF6E00',
      'var(--accent)',
    ]) {
      const doc = createEmptyDoc()
      doc.theme.accentHex = accent
      expect(messagesOf(doc), accent).toContain('Warna harus hex 6 digit. Contoh: #FF6E00.')
    }
  })

  it('theme.fontScale: hanya lima token skala yang diterima', () => {
    for (const scale of [0.9, 0.95, 1, 1.05, 1.1]) {
      const doc = createEmptyDoc()
      doc.theme.fontScale = scale
      expect(messagesOf(doc), String(scale)).toHaveLength(0)
    }
    for (const scale of [0, 0.85, 0.92, 1.12, 1.2, -1]) {
      const doc = createEmptyDoc()
      doc.theme.fontScale = scale
      expect(() => parseResumeDoc(doc), String(scale)).toThrow()
    }
  })

  it('meta: createdAt & updatedAt harus positif, lastCheckedAt boleh null', () => {
    for (const bad of [0, -1, -0.5]) {
      const created = createEmptyDoc()
      created.meta.createdAt = bad
      expect(() => parseResumeDoc(created), String(bad)).toThrow()

      const updated = createEmptyDoc()
      updated.meta.updatedAt = bad
      expect(() => parseResumeDoc(updated), String(bad)).toThrow()

      const checked = createEmptyDoc()
      checked.meta.lastCheckedAt = bad
      expect(() => parseResumeDoc(checked), String(bad)).toThrow()
    }

    const ok = createEmptyDoc()
    ok.meta.lastCheckedAt = null
    expect(messagesOf(ok)).toHaveLength(0)

    const stamped = createEmptyDoc()
    stamped.meta.lastCheckedAt = 1700000000000
    expect(messagesOf(stamped)).toHaveLength(0)
  })

  it('judul dan id punya batas sendiri', () => {
    const longTitle = createEmptyDoc()
    longTitle.title = 'x'.repeat(201)
    expect(messagesOf(longTitle)).toContain('Judul maksimal 200 karakter.')

    const emptyId = structuredClone(createEmptyDoc()) as ResumeDoc
    emptyId.id = ''
    expect(() => parseResumeDoc(emptyId)).toThrow()

    const emptySectionId = structuredClone(createEmptyDoc()) as ResumeDoc
    emptySectionId.sections[0]!.id = ''
    expect(messagesOf(emptySectionId)).toContain('ID entri tidak boleh kosong.')
  })

  it('sections wajib array berisi minimal satu bagian yang dikenal', () => {
    const noSections = structuredClone(createEmptyDoc()) as unknown as Record<string, unknown>
    delete noSections.sections
    expect(issuesOf(noSections).some((issue) => issue.path === 'sections')).toBe(true)

    const emptyArray = { ...createEmptyDoc(), sections: [] }
    expect(messagesOf(emptyArray)).toContain('Dokumen harus punya minimal satu bagian.')

    expect(corruptDocShapeFixture.sections).toBe('seharusnya-array')
    expect(() => migrate(corruptDocShapeFixture)).toThrow()
  })

  it('entri section dengan kind tidak dikenal atau bullet bukan string ditolak', () => {
    const alien = {
      id: 'sec-x',
      kind: 'hobbies',
      visible: true,
      data: { entries: [] },
    } as unknown as SectionInstance
    expect(() => parseResumeDoc(docWithSections([alien]))).toThrow()

    const wrongBullets = experienceSection([
      { ...experienceEntryWithBullets(1), bullets: ['ok', 42 as unknown as string] },
    ])
    expect(() => parseResumeDoc(docWithSections([wrongBullets]))).toThrow()

    const mismatchedKindData = {
      id: 'sec-exp',
      kind: 'experience',
      visible: true,
      data: { text: 'bukan entries' },
    } as unknown as SectionInstance
    expect(() => parseResumeDoc(docWithSections([mismatchedKindData]))).toThrow()
  })
})

describe('migrate — jalur default dan pemulihan (baris 282)', () => {
  it('v0 sebagian: halaman & tema diisi default', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1712345678901)
    const doc = migrate(v0DocFixture)
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.settings.page).toEqual({ size: 'A4', marginMm: 18, showPageNumbers: true })
    expect(doc.settings.language).toBe('id')
    expect(doc.theme).toEqual({ accentHex: null, fontScale: 1 })
    expect(doc.jobDescription).toBeNull()
    expect(doc.meta).toEqual({
      createdAt: 1712345678901,
      updatedAt: 1700000000000,
      lastCheckedAt: null,
    })
  })

  it('v0 lengkap: nilai aslinya dipertahankan, termasuk showPageNumbers false', () => {
    const doc = migrate(v0DocFullFixture)
    expect(doc.settings.page).toEqual({ size: 'LETTER', marginMm: 20, showPageNumbers: false })
    expect(doc.settings.language).toBe('en')
    expect(doc.theme).toEqual({ accentHex: '#123456', fontScale: 0.95 })
    expect(doc.jobDescription).toBe('Deskripsi lowongan lama')
    expect(doc.meta).toEqual({
      createdAt: 1600000000000,
      updatedAt: 1700000000000,
      lastCheckedAt: 1650000000000,
    })
  })

  it('v0 tanpa settings/theme/meta sama sekali tetap bisa dimigrasi', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000009999)
    const doc = migrate({
      id: 'doc-min',
      title: 'Minim',
      templateId: 'ledger',
      sections: [{ id: 's1', kind: 'summary', visible: true, data: { text: 'Halo' } }],
    })
    expect(doc.settings.page).toEqual({ size: 'A4', marginMm: 18, showPageNumbers: true })
    expect(doc.theme).toEqual({ accentHex: null, fontScale: 1 })
    expect(doc.jobDescription).toBeNull()
    expect(doc.meta.createdAt).toBe(1700000009999)
    expect(doc.meta.lastCheckedAt).toBeNull()
  })

  it('settings.page sebagian: setiap kunci punya default sendiri', () => {
    const base = {
      id: 'doc-page',
      title: 'Parsial',
      templateId: 'minimal',
      sections: [{ id: 's1', kind: 'summary', visible: false, data: { text: 'Isi' } }],
    }
    expect(migrate({ ...base, settings: { page: { size: 'LETTER' } } }).settings.page).toEqual({
      size: 'LETTER',
      marginMm: 18,
      showPageNumbers: true,
    })
    expect(migrate({ ...base, settings: { page: { marginMm: 25 } } }).settings.page).toEqual({
      size: 'A4',
      marginMm: 25,
      showPageNumbers: true,
    })
    // `?? true`, bukan `|| true`: nilai false lama tidak boleh tertimpa default.
    expect(
      migrate({ ...base, settings: { page: { showPageNumbers: false } } }).settings.page,
    ).toEqual({ size: 'A4', marginMm: 18, showPageNumbers: false })
    // marginMm 0 ikut dipertahankan oleh ?? lalu ditolak schema (bukan dinormalisasi).
    expect(
      zodMessagesOf(() => migrate({ ...base, settings: { page: { marginMm: 0 } } })),
    ).toContain('Margin minimal 5 mm.')
    expect(migrate({ ...base, settings: { page: {} } }).settings.page).toEqual({
      size: 'A4',
      marginMm: 18,
      showPageNumbers: true,
    })
    expect(migrate({ ...base, settings: {} }).settings).toEqual({
      page: { size: 'A4', marginMm: 18, showPageNumbers: true },
      language: 'id',
    })
  })

  it('jobDescription hilang menjadi null, nilai kosong tetap string kosong', () => {
    const base = {
      id: 'doc-jd',
      title: 'JD',
      templateId: 'ledger',
      sections: [{ id: 's1', kind: 'summary', visible: true, data: { text: 'Isi' } }],
    }
    expect(migrate(base).jobDescription).toBeNull()
    expect(migrate({ ...base, jobDescription: undefined }).jobDescription).toBeNull()
    expect(migrate({ ...base, jobDescription: '' }).jobDescription).toBe('')
    expect(migrate({ ...base, jobDescription: 'Deskripsi' }).jobDescription).toBe('Deskripsi')
  })

  it('theme.accentHex kosong dipertahankan "", yang lain menjadi null', () => {
    const base = {
      id: 'doc-theme',
      title: 'Tema',
      templateId: 'ledger',
      sections: [{ id: 's1', kind: 'summary', visible: true, data: { text: 'Isi' } }],
    }
    expect(migrate({ ...base, theme: { accentHex: '' } }).theme).toEqual({
      accentHex: '',
      fontScale: 1,
    })
    expect(migrate({ ...base, theme: { accentHex: null } }).theme.accentHex).toBeNull()
    expect(migrate({ ...base, theme: {} }).theme.accentHex).toBeNull()
    expect(migrate({ ...base, theme: { fontScale: 1.05 } }).theme.fontScale).toBe(1.05)
    expect(migrate({ ...base, theme: null }).theme).toEqual({ accentHex: null, fontScale: 1 })
    // nilai string untuk fontScale tidak dinormalisasi: schema yang menolak.
    expect(() => migrate({ ...base, theme: { fontScale: '1' } })).toThrow()
  })

  it('meta dengan tipe salah jatuh ke default, lastCheckedAt null dipertahankan', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000555000)
    const base = {
      id: 'doc-meta',
      title: 'Meta',
      templateId: 'ledger',
      sections: [{ id: 's1', kind: 'summary', visible: true, data: { text: 'Isi' } }],
    }
    expect(migrate({ ...base, meta: { createdAt: '123' } }).meta.createdAt).toBe(1700000555000)
    expect(migrate({ ...base, meta: { updatedAt: '123' } }).meta.updatedAt).toBe(1700000555000)
    expect(migrate({ ...base, meta: { lastCheckedAt: '123' } }).meta.lastCheckedAt).toBeNull()
    expect(migrate({ ...base, meta: { lastCheckedAt: null } }).meta.lastCheckedAt).toBeNull()
    expect(migrate({ ...base, meta: {} }).meta.lastCheckedAt).toBeNull()
    expect(migrate({ ...base, meta: null }).meta.createdAt).toBe(1700000555000)
  })

  it('schemaVersion string dianggap versi 0 dan ikut dimigrasi', () => {
    const doc = migrate({
      id: 'doc-str-ver',
      title: 'Versi string',
      templateId: 'ledger',
      schemaVersion: '1',
      sections: [{ id: 's1', kind: 'summary', visible: true, data: { text: 'Isi' } }],
    })
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.settings.page.marginMm).toBe(18)
  })

  it('v1 yang sudah valid dilewatkan tanpa perubahan', () => {
    const original = createSampleDoc()
    expect(migrate(original)).toEqual(original)
  })

  it('masukan bukan objek dan versi tak dikenal melempar galat spesifik', () => {
    expect(() => migrate(corruptDocStringFixture)).toThrow('Dokumen bukan objek.')
    expect(() => migrate(null)).toThrow('Dokumen bukan objek.')
    expect(() => migrate(undefined)).toThrow('Dokumen bukan objek.')
    expect(() => migrate([1, 2, 3])).toThrow('Dokumen bukan objek.')
    expect(() => migrate(42)).toThrow('Dokumen bukan objek.')
    expect(() => migrate({ schemaVersion: 99 })).toThrow('lebih baru')
    expect(() => migrate({ schemaVersion: -1 })).toThrow('Tidak ada jalur migrasi')
  })

  it('dokumen rusak melempar ZodError (bukan dipulihkan diam-diam)', () => {
    const withoutSections = { id: 'doc-x', title: 'X', templateId: 'ledger', sections: [] }
    const messages = zodMessagesOf(() => migrate(withoutSections))
    expect(messages).toContain('Dokumen harus punya minimal satu bagian.')

    const wrongSectionsType = {
      id: 'doc-y',
      title: 'Y',
      templateId: 'ledger',
      sections: 'seharusnya-array',
    }
    expect(zodMessagesOf(() => migrate(wrongSectionsType)).length).toBeGreaterThan(0)

    let caught: unknown
    try {
      migrate({
        ...v0DocFixture,
        sections: [{ id: '', kind: 'summary', visible: true, data: { text: 'a' } }],
      })
    } catch (error) {
      caught = error
    }
    expect((caught as Error).name).toBe('ZodError')
    expect(
      zodMessagesOf(() =>
        migrate({
          ...v0DocFixture,
          sections: [{ id: '', kind: 'summary', visible: true, data: { text: 'a' } }],
        }),
      ),
    ).toContain('ID entri tidak boleh kosong.')
  })

  it('SECTION_ORDER dipakai untuk seluruh jenis bagian baru', () => {
    expect(SECTION_ORDER).toEqual([
      'profile',
      'summary',
      'experience',
      'education',
      'skills',
      'projects',
      'certifications',
      'languages',
      'awards',
      'volunteering',
    ])
    for (const kind of SECTION_ORDER) {
      const doc = createEmptyDoc()
      const section = doc.sections.find((item) => item.kind === kind)
      expect(section, kind).toBeDefined()
      expect(section?.data).toEqual(createEmptySectionData(kind))
    }
  })
})

describe('factory — id, tema default dan versi skema', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  it('createEmptyEntry memakai crypto.randomUUID dan berbeda tiap panggilan', () => {
    const kinds = [
      'experience',
      'education',
      'projects',
      'certifications',
      'languages',
      'awards',
      'volunteering',
    ] as const
    const seen = new Set<string>()
    for (const kind of kinds) {
      const entry = createEmptyEntry(kind)
      expect(entry.id, kind).toMatch(UUID_RE)
      seen.add(entry.id)
    }
    expect(seen.size).toBe(kinds.length)
    expect(createEmptyEntry('experience').id).not.toBe(createEmptyEntry('experience').id)
  })

  it('isi default createEmptyEntry per kind sesuai skema', () => {
    expect(createEmptyEntry('experience')).toEqual({
      id: expect.stringMatching(UUID_RE),
      role: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      bullets: [],
      stack: [],
    })
    expect(createEmptyEntry('education')).toMatchObject({ gpa: '', notes: [] })
    expect(createEmptyEntry('projects')).toMatchObject({ name: '', url: '', stack: [] })
    expect(createEmptyEntry('certifications')).toMatchObject({ credentialId: '', issuedAt: '' })
    expect(createEmptyEntry('languages')).toMatchObject({ proficiency: 'Intermediate' })
    expect(createEmptyEntry('awards')).toMatchObject({ title: '', description: '' })
    expect(createEmptyEntry('volunteering')).toMatchObject({ current: false, bullets: [] })
  })

  it('createEmptySectionData menutup semua cabang kinds', () => {
    expect(createEmptyProfile()).toEqual({
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      links: [],
      photoEnabled: false,
    })
    expect(createEmptySectionData('profile')).toEqual(createEmptyProfile())
    expect(createEmptySectionData('profile').photoEnabled).toBe(false)
    expect(createEmptySectionData('summary')).toEqual({ text: '' })
    expect(createEmptySectionData('skills')).toEqual({ groups: [] })
    for (const kind of [
      'experience',
      'education',
      'projects',
      'certifications',
      'languages',
      'awards',
      'volunteering',
    ] as const) {
      expect(createEmptySectionData(kind), kind).toEqual({ entries: [] })
    }
  })

  it('createEmptyDoc: 10 bagian ber-id uuid, photoEnabled false, schemaVersion kini', () => {
    const doc = createEmptyDoc()
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    for (const section of doc.sections) {
      expect(section.id).toMatch(UUID_RE)
      if (section.kind === 'profile') expect(section.data.photoEnabled).toBe(false)
    }
    expect(new Set(doc.sections.map((section) => section.id)).size).toBe(doc.sections.length)
    expect(doc.theme).toEqual({ accentHex: null, fontScale: 1 })
    expect(doc.jobDescription).toBeNull()
    expect(doc.meta.lastCheckedAt).toBeNull()
    expect(doc.id).toMatch(UUID_RE)
  })

  it('createSampleDoc: id dari factory, photoEnabled false, schemaVersion kini, lolos parse', () => {
    const doc = createSampleDoc()
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(() => parseResumeDoc(doc)).not.toThrow()

    const ids: string[] = [doc.id]
    for (const section of doc.sections) {
      expect(section.id).toMatch(UUID_RE)
      ids.push(section.id)
      if (section.kind === 'profile') {
        expect(section.data.photoEnabled).toBe(false)
        for (const link of section.data.links) expect(link.url).not.toMatch(/javascript:/i)
      }
      if ('entries' in section.data) {
        for (const entry of section.data.entries as { id: string }[]) {
          expect(entry.id).toMatch(UUID_RE)
          ids.push(entry.id)
        }
      }
      if (section.kind === 'skills') {
        for (const group of section.data.groups) {
          expect(group.id).toMatch(UUID_RE)
          ids.push(group.id)
        }
      }
    }
    expect(new Set(ids).size).toBe(ids.length)

    const other = createSampleDoc()
    expect(other.id).not.toBe(doc.id)
    expect(other.sections[0]?.id).not.toBe(doc.sections[0]?.id)
  })

  it('dua dokumen pabrik punya meta berbeda tapi struktur sama', () => {
    expect(createEmptyDoc().sections.map((section) => section.kind)).toEqual([...SECTION_ORDER])
    expect(createSampleDoc().sections.map((section) => section.kind)).toEqual([...SECTION_ORDER])
    expect(createSampleDoc().settings.language).toBe('id')
    expect(createSampleDoc().templateId).toBe('classic-ats')
  })
})
