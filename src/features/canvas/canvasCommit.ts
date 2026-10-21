import type { z } from 'zod'
import {
  awardSchema,
  certificationSchema,
  DOC_LIMITS,
  educationSchema,
  experienceSchema,
  languageSchema,
  linkItemSchema,
  profileSchema,
  projectSchema,
  skillGroupSchema,
  summarySchema,
  volunteeringSchema,
  type EntriesSectionKind,
  type SectionData,
} from '@/schema/resume'
import type { ProfileData, ResumeDoc, SkillGroup } from '@/types/resume'
import { breakEditCoalesce, useDocStore, type SectionEntry } from '@/store/docStore'
import {
  bulletListKeyOf,
  entryRecordOf,
  parseChips,
  type CanvasDatesPatch,
  type CanvasFieldTarget,
} from './canvasFields'

/**
 * Validasi & penulisan field kanvas (field bagian C3, field entri C4).
 *
 * Validasi memakai schema zod yang sudah ada (`schema/resume.ts`), bukan aturan
 * terpisah, supaya pesan error di kanvas sama dengan pesan error di form (D3).
 * Penulisan memakai jalur yang sama dengan form — `docStore.updateSection` untuk
 * field bagian, `docStore.updateEntry` untuk field entri — sehingga autosave dan
 * riwayat ikut satu sumber (D8).
 */

/** Pesan zod pertama untuk sebuah field; `null` bila field itu valid. */
const issueFor = <T>(result: z.ZodSafeParseResult<T>, field: string): string | null => {
  if (result.success) return null
  return issueIn(result.error.issues, field)
}

/** Issue zod yang dibutuhkan sini: pesan + kunci field teratas. */
type IssueLike = { path: readonly (string | number | symbol)[]; message: string }

/** Pesan pertama milik satu field dari daftar issue zod. */
const issueIn = (issues: readonly IssueLike[], field: string): string | null =>
  issues.find((item) => String(item.path[0]) === field)?.message ?? null

/**
 * Hasil validasi satu entri. Bentuknya sendiri (bukan `ZodSafeParseResult` per
 * skema) supaya ketujuh skema entri bisa dikembalikan dari satu fungsi tanpa
 * union yang tidak bisa dibedakan TypeScript.
 */
type ParseOutcome = { issues: IssueLike[] }

/** Skema entri per jenis — sama dengan yang dipakai kartu entri di form. */
const parseEntry = (kind: EntriesSectionKind, value: unknown): ParseOutcome => {
  const run = <T>(schema: z.ZodType<T, unknown>): ParseOutcome => {
    const result = schema.safeParse(value)
    return result.success ? { issues: [] } : { issues: result.error.issues }
  }
  switch (kind) {
    case 'experience':
      return run(experienceSchema)
    case 'education':
      return run(educationSchema)
    case 'projects':
      return run(projectSchema)
    case 'certifications':
      return run(certificationSchema)
    case 'languages':
      return run(languageSchema)
    case 'awards':
      return run(awardSchema)
    default:
      return run(volunteeringSchema)
  }
}

const sectionOf = (doc: ResumeDoc, sectionId: string) =>
  doc.sections.find((item) => item.id === sectionId)

const entriesOf = (section: ResumeDoc['sections'][number] | undefined) =>
  section && 'entries' in section.data ? (section.data.entries as SectionEntry[]) : []

/**
 * Daftar bullet setelah satu baris ditulis. Bullet yang dikosongkan dihapus
 * dari model — sama seperti tombol hapus di `BulletListEditor`, dan barisnya
 * memang tidak pernah digambar bila kosong (`contentLines`).
 */
const nextBulletList = (
  entry: Record<string, unknown>,
  list: 'bullets' | 'notes',
  index: number,
  value: string,
): string[] => {
  const items = Array.isArray(entry[list]) ? (entry[list] as unknown[]).map(String) : []
  if (value.trim() === '') return items.filter((_, position) => position !== index)
  if (index >= items.length) return [...items, value]
  return items.map((item, position) => (position === index ? value : item))
}

/** Kunci yang disentuh sebuah patch tanggal — dipakai untuk membaca error milik field ini saja. */
const dateFieldsOf = (patch: CanvasDatesPatch): string[] =>
  'issuedAt' in patch
    ? ['issuedAt']
    : 'awardedAt' in patch
      ? ['awardedAt']
      : ['startDate', 'endDate']

/**
 * Validasi satu field yang hendak ditulis. Error milik field lain diabaikan:
 * Canvas hanya boleh menolak nilai yang memang sedang diedit.
 */
export const validateCanvasField = (target: CanvasFieldTarget, value: string): string | null => {
  const doc = useDocStore.getState().doc
  const section = sectionOf(doc, target.sectionId)
  if (!section) return null
  switch (target.kind) {
    case 'profile': {
      const profile = section.data as ProfileData
      return issueFor(profileSchema.safeParse({ ...profile, [target.field]: value }), target.field)
    }
    case 'profile-link': {
      const profile = section.data as ProfileData
      const link = profile.links[target.index]
      if (!link) return null
      return issueFor(linkItemSchema.safeParse({ ...link, url: value }), 'url')
    }
    case 'summary':
      return issueFor(summarySchema.safeParse({ text: value }), 'text')
    case 'skill-name': {
      if (section.kind !== 'skills') return null
      const group = section.data.groups.find((item) => item.id === target.groupId)
      if (!group) return null
      return issueFor(skillGroupSchema.safeParse({ ...group, name: value }), 'name')
    }
    case 'skill-items': {
      if (section.kind !== 'skills') return null
      const group = section.data.groups.find((item) => item.id === target.groupId)
      if (!group) return null
      return issueFor(skillGroupSchema.safeParse({ ...group, items: parseChips(value) }), 'items')
    }
    case 'entry-text': {
      const entry = entryRecordOf(doc, target.sectionId, target.entryId)
      if (!entry) return null
      return issueIn(
        parseEntry(target.entryKind, { ...entry, [target.field]: value }).issues,
        target.field,
      )
    }
    case 'entry-bullet': {
      const list = bulletListKeyOf(target.entryKind)
      if (!list) return null
      const entry = entryRecordOf(doc, target.sectionId, target.entryId)
      if (!entry) return null
      return issueIn(
        parseEntry(target.entryKind, {
          ...entry,
          [list]: nextBulletList(entry, list, target.index, value),
        }).issues,
        list,
      )
    }
    case 'entry-dates':
      // Tanggal divalidasi lewat `validateCanvasDates` (patch, bukan satu string).
      return null
  }
}

/**
 * Menulis nilai ke dokumen lewat jalur yang sama dengan form.
 *
 * Jendela coalesce history (150 ms) diputus sebelum & sesudah commit supaya
 * satu sesi edit = satu langkah undo, dan supaya ketikan form berikutnya tidak
 * menyatu dengan commit kanvas (D9).
 */
export const writeCanvasField = (target: CanvasFieldTarget, value: string): void => {
  const store = useDocStore.getState()
  const sectionId = target.sectionId
  breakEditCoalesce()
  switch (target.kind) {
    case 'profile':
      store.updateSection(
        sectionId,
        (prev) =>
          ({
            ...(prev as ProfileData),
            [target.field]: value,
          }) as SectionData,
      )
      break
    case 'profile-link':
      store.updateSection(sectionId, (prev) => {
        const profile = prev as ProfileData
        return {
          ...profile,
          links: profile.links.map((link, index) =>
            index === target.index ? { ...link, url: value } : link,
          ),
        }
      })
      break
    case 'summary':
      store.updateSection(sectionId, () => ({ text: value }))
      break
    case 'skill-name':
      store.updateSection(sectionId, (prev) => ({
        ...prev,
        groups: (prev as { groups: SkillGroup[] }).groups.map((group) =>
          group.id === target.groupId ? { ...group, name: value } : group,
        ),
      }))
      break
    case 'skill-items':
      store.updateSection(sectionId, (prev) => ({
        ...prev,
        groups: (prev as { groups: SkillGroup[] }).groups.map((group) =>
          group.id === target.groupId ? { ...group, items: parseChips(value) } : group,
        ),
      }))
      break
    case 'entry-text':
      store.updateEntry(sectionId, target.entryId, (entry) => {
        const next = { ...(entry as Record<string, unknown>), [target.field]: value }
        return next as SectionEntry
      })
      break
    case 'entry-bullet': {
      const list = bulletListKeyOf(target.entryKind)
      if (!list) break
      store.updateEntry(sectionId, target.entryId, (entry) => {
        const source = entry as Record<string, unknown>
        const next = { ...source, [list]: nextBulletList(source, list, target.index, value) }
        return next as SectionEntry
      })
      break
    }
    case 'entry-dates':
      // Tanggal ditulis lewat `writeCanvasDates`.
      break
  }
  breakEditCoalesce()
}

/**
 * Validasi patch tanggal memakai skema entri pemiliknya: format `YYYY-MM`
 * dijaga zod, sama seperti di form (D3).
 */
export const validateCanvasDates = (
  target: CanvasFieldTarget,
  patch: CanvasDatesPatch,
): string | null => {
  if (target.kind !== 'entry-dates') return null
  const doc = useDocStore.getState().doc
  const entry = entryRecordOf(doc, target.sectionId, target.entryId)
  if (!entry) return null
  const { issues } = parseEntry(target.entryKind, { ...entry, ...patch })
  for (const field of dateFieldsOf(patch)) {
    const message = issueIn(issues, field)
    if (message) return message
  }
  return null
}

/** Menulis patch tanggal ke entri — `endDate` dibuang saat `current`, sama seperti form. */
export const writeCanvasDates = (target: CanvasFieldTarget, patch: CanvasDatesPatch): void => {
  if (target.kind !== 'entry-dates') return
  const store = useDocStore.getState()
  breakEditCoalesce()
  store.updateEntry(target.sectionId, target.entryId, (entry) => {
    const next = { ...(entry as Record<string, unknown>), ...patch }
    return next as SectionEntry
  })
  breakEditCoalesce()
}

/**
 * Ghost row "+ Tambahkan entri" (D10). Mengembalikan id entri baru supaya
 * pemanggilnya langsung bisa membuka sesi field pertama entri itu; `null` bila
 * `DOC_LIMITS.entriesPerSection` tercapai (`addEntry` menolak diam-diam, jadi
 * batasnya diperiksa di sini).
 */
export const addCanvasEntry = (sectionId: string): string | null => {
  const store = useDocStore.getState()
  const before = sectionOf(store.doc, sectionId)
  if (!before || !('entries' in before.data)) return null
  if (entriesOf(before).length >= DOC_LIMITS.entriesPerSection) return null
  breakEditCoalesce()
  store.addEntry(sectionId)
  breakEditCoalesce()
  const created = entriesOf(sectionOf(useDocStore.getState().doc, sectionId)).at(-1)
  return created?.id ?? null
}

/**
 * Ghost row "+ Tambahkan bullet" (D10): mendorong string kosong seperti
 * `BulletListEditor`, lalu mengembalikan indeksnya sebagai slot sesi edit.
 * `null` bila `DOC_LIMITS.bulletsPerEntry` tercapai.
 */
export const addCanvasBullet = (
  sectionId: string,
  entryId: string,
  entryKind: EntriesSectionKind,
): number | null => {
  const list = bulletListKeyOf(entryKind)
  if (!list) return null
  const doc = useDocStore.getState().doc
  const entry = entryRecordOf(doc, sectionId, entryId)
  if (!entry) return null
  const items = Array.isArray(entry[list]) ? (entry[list] as unknown[]) : []
  if (items.length >= DOC_LIMITS.bulletsPerEntry) return null
  breakEditCoalesce()
  useDocStore.getState().updateEntry(sectionId, entryId, (source) => {
    const next = { ...(source as Record<string, unknown>), [list]: [...items, ''] }
    return next as SectionEntry
  })
  breakEditCoalesce()
  return items.length
}
