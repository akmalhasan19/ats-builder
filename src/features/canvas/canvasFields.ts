import { normalizeUrlInput } from '@/lib/text'
import { sectionRegistry } from '@/features/sections/registry'
import { entryBulletListKey } from '@/features/templates/fieldSegments'
import type { EntriesSectionKind } from '@/features/templates/contentLines'
import type { GuideId } from '@/features/templates/fieldSegments'
import type { ProfileData, ResumeDoc, SkillGroup } from '@/types/resume'

/**
 * Peta field kanvas: path model → target tulis, widget editor, dan aturan
 * wajib/tidak.
 *
 * Path-nya sama persis dengan atribut `data-field` di DOM (D4/C2), jadi
 * segmentasi (C2) dan penulisan (C3/C4) membaca satu sumber yang sama. Target
 * tulis memakai jalur yang sama dengan form — `docStore.updateSection` untuk
 * field bagian, `docStore.updateEntry` untuk field entri — sehingga autosave,
 * validasi, dan undo berjalan satu jalur (D8).
 */

/** Widget editor: baris tunggal, textarea, teks pecah-koma, popover tanggal. */
export type CanvasWidget = 'input' | 'textarea' | 'chips' | 'dates'

export type ProfileFieldKey = 'fullName' | 'headline' | 'email' | 'phone' | 'location'

export type CanvasFieldTarget =
  | { kind: 'profile'; sectionId: string; field: ProfileFieldKey }
  | { kind: 'profile-link'; sectionId: string; index: number }
  | { kind: 'summary'; sectionId: string }
  | { kind: 'skill-name'; sectionId: string; groupId: string }
  | { kind: 'skill-items'; sectionId: string; groupId: string }
  | {
      kind: 'entry-text'
      sectionId: string
      entryKind: EntriesSectionKind
      entryId: string
      field: string
    }
  | {
      kind: 'entry-dates'
      sectionId: string
      entryKind: EntriesSectionKind
      entryId: string
    }
  | {
      kind: 'entry-bullet'
      sectionId: string
      entryKind: EntriesSectionKind
      entryId: string
      index: number
    }

export type CanvasFieldSpec = {
  /** Tujuan tulis field ini. */
  target: CanvasFieldTarget
  /** Widget editor yang dipakai (D3). */
  widget: CanvasWidget
  /** Field wajib — kosong berarti revert + toast, bukan dihapus (D3). */
  required: boolean
  /** Guide yang jadi placeholder editor (D5). */
  guideId: GuideId
  /**
   * Textarea yang satu lapangan (bullet) commit dengan Enter biasa — keputusan
   * owner OQ6. Ringkasan tetap Ctrl/Cmd+Enter (D3).
   */
  enterCommits: boolean
}

/**
 * Bentuk editor tanggal per jenis entri, mengikuti tanggal yang memang digambar
 * dokumen (matriks §4): pendidikan & bahasa tidak menampilkan tanggal, jadi
 * tidak ada target editnya di kertas.
 */
export type CanvasDatesShape =
  { mode: 'range'; current: boolean } | { mode: 'single'; field: 'issuedAt' | 'awardedAt' }

export const datesShapeOf = (entryKind: EntriesSectionKind): CanvasDatesShape | null => {
  switch (entryKind) {
    case 'experience':
    case 'volunteering':
      return { mode: 'range', current: true }
    case 'projects':
      return { mode: 'range', current: false }
    case 'certifications':
      return { mode: 'single', field: 'issuedAt' }
    case 'awards':
      return { mode: 'single', field: 'awardedAt' }
    default:
      return null
  }
}

/** Nama array bullet pemilik baris entri; `null` = jenis ini tidak punya bullet. */
export const bulletListKeyOf = entryBulletListKey

/**
 * Nilai yang ditulis editor tanggal. Bentuknya mengikuti `datesShapeOf`, jadi
 * proyek (tanpa `current`) dan sertifikasi/penghargaan (satu tanggal) tidak
 * pernah menulis field yang tidak ada di skema entri mereka.
 */
export type CanvasDatesPatch =
  | { startDate: string; endDate: string; current: boolean }
  | { issuedAt: string }
  | { awardedAt: string }

/** Field teks bebas kepala entri yang editable — persis matriks §4. */
const ENTRY_TEXT_FIELDS: Record<EntriesSectionKind, readonly string[]> = {
  experience: ['role', 'company', 'location'],
  education: ['degree', 'field', 'institution', 'location'],
  projects: ['name', 'role'],
  certifications: ['name', 'issuer'],
  languages: ['name'],
  awards: ['title'],
  volunteering: ['role', 'organization'],
}

const ENTRY_PATH_RE = /^entries\.([a-z-]+)\.([^.]+)\.(.+)$/
const BULLET_PATH_RE = /^(bullets|notes)\[(\d+)\]$/

const isEntriesKind = (value: string): value is EntriesSectionKind => value in ENTRY_TEXT_FIELDS

/**
 * Id maya untuk blok guide kelompok skill (blok tanpa grup nyata). Field-nya
 * belum bisa diedit — menambah kelompok skill tetap milik form, dan
 * ghost row on-canvas (D10) tidak memuat kelompok skill.
 */
export const GUIDE_GROUP_ID = 'new'

/**
 * Id maya untuk blok guide kepala entri / baris entri pada bagian yang masih
 * kosong. Entrinya belum ada di dokumen, jadi kuncinya menunjuk slot yang akan
 * dibuat — pembuatannya lewat ghost row "+ Tambahkan entri" (D10).
 */
export const GUIDE_ENTRY_ID = 'new'

const PROFILE_FIELDS: Record<
  ProfileFieldKey,
  { widget: CanvasWidget; required: boolean; guideId: GuideId }
> = {
  fullName: { widget: 'input', required: true, guideId: 'fullName' },
  headline: { widget: 'input', required: true, guideId: 'headline' },
  email: { widget: 'input', required: true, guideId: 'email' },
  phone: { widget: 'input', required: true, guideId: 'phone' },
  location: { widget: 'input', required: false, guideId: 'location' },
}

/**
 * Deskripsi field yang bisa diedit di atas kertas (matriks §4). Field di luar
 * matriks dan blok guide kelompok skill mengembalikan `null`: segmennya tetap
 * tombol tanpa aksi, seperti pada C2.
 */
export const canvasFieldSpecOf = (sectionId: string, path: string): CanvasFieldSpec | null => {
  const link = /^profile\.links\.(\d+)\.url$/.exec(path)
  if (link) {
    return {
      target: { kind: 'profile-link', sectionId, index: Number(link[1]) },
      widget: 'input',
      required: false,
      guideId: 'link',
      enterCommits: false,
    }
  }

  if (path.startsWith('profile.')) {
    const field = path.slice('profile.'.length) as ProfileFieldKey
    const spec = PROFILE_FIELDS[field]
    if (!spec) return null
    return {
      target: { kind: 'profile', sectionId, field },
      ...spec,
      enterCommits: false,
    }
  }

  if (path === 'summary.text') {
    return {
      target: { kind: 'summary', sectionId },
      widget: 'textarea',
      required: true,
      guideId: 'summary',
      enterCommits: false,
    }
  }

  const skill = /^skills\.groups\.([^.]+)\.(name|items)$/.exec(path)
  if (skill) {
    const groupId = skill[1]!
    if (groupId === GUIDE_GROUP_ID) return null
    if (skill[2] === 'name') {
      return {
        target: { kind: 'skill-name', sectionId, groupId },
        widget: 'input',
        required: true,
        guideId: 'skillGroupName',
        enterCommits: false,
      }
    }
    return {
      target: { kind: 'skill-items', sectionId, groupId },
      widget: 'chips',
      required: true,
      guideId: 'skillGroupItems',
      enterCommits: false,
    }
  }

  const entry = ENTRY_PATH_RE.exec(path)
  if (!entry) return null
  const entryKind = entry[1]!
  const entryId = entry[2]!
  const rest = entry[3]!
  if (!isEntriesKind(entryKind)) return null
  // Entri maya pada kerangka guide (bagian yang masih kosong): entri itu belum
  // ada di dokumen, jadi pembuatannya lewat ghost row "+ Tambahkan entri" (D10)
  // — sama seperti kelompok skill maya pada C3.
  if (entryId === GUIDE_ENTRY_ID) return null

  if (rest === 'dates') {
    if (!datesShapeOf(entryKind)) return null
    return {
      target: { kind: 'entry-dates', sectionId, entryKind, entryId },
      widget: 'dates',
      required: false,
      guideId: 'dates',
      enterCommits: false,
    }
  }

  const bullet = BULLET_PATH_RE.exec(rest)
  if (bullet) {
    if (bulletListKeyOf(entryKind) !== bullet[1]) return null
    return {
      target: {
        kind: 'entry-bullet',
        sectionId,
        entryKind,
        entryId,
        index: Number(bullet[2]),
      },
      widget: 'textarea',
      required: false,
      guideId: 'bullet',
      // OQ6 — satu bullet adalah satu baris: Enter langsung commit.
      enterCommits: true,
    }
  }

  if (!ENTRY_TEXT_FIELDS[entryKind].includes(rest)) return null
  return {
    target: { kind: 'entry-text', sectionId, entryKind, entryId, field: rest },
    widget: 'input',
    required: sectionRegistry[entryKind].requiredFields.includes(rest),
    guideId: rest as GuideId,
    enterCommits: false,
  }
}

/** Path field pertama sebuah entri baru — tujuan sesi setelah ghost row menambahnya (D10). */
export const firstEntryFieldPath = (entryKind: EntriesSectionKind, entryId: string): string =>
  `entries.${entryKind}.${entryId}.${ENTRY_TEXT_FIELDS[entryKind][0]}`

/**
 * Id entri pemilik sebuah path (`entries.<kind>.<id>.…`), `undefined` untuk
 * field bagian. Dipakai saat sesi dibuka dari luar kertas (C5.2).
 */
export const entryIdForField = (path: string): string | undefined => ENTRY_PATH_RE.exec(path)?.[2]

/**
 * Kunci blok pemilik field — sama dengan format `blocks.ts` (`{sectionId}:header`,
 * `{sectionId}:summary`, `{sectionId}:{groupId}`, `{sectionId}:{itemId}:head`,
 * `{sectionId}:{itemId}:l{lineIndex}`), dipakai untuk menandai blok yang sedang
 * diedit (D6) tanpa menambah prop baru (D13).
 */
export const blockKeyForField = (sectionId: string, path: string): string => {
  if (path.startsWith('profile.')) return `${sectionId}:header`
  if (path.startsWith('summary.')) return `${sectionId}:summary`
  const skill = /^skills\.groups\.([^.]+)\./.exec(path)
  if (skill) return `${sectionId}:${skill[1]}`
  const entry = ENTRY_PATH_RE.exec(path)
  if (entry) {
    const entryId = entry[2]!
    const rest = entry[3]!
    const bullet = BULLET_PATH_RE.exec(rest)
    return bullet ? `${sectionId}:${entryId}:l${bullet[2]}` : `${sectionId}:${entryId}:head`
  }
  return sectionId
}

const sectionOf = (doc: ResumeDoc, sectionId: string) =>
  doc.sections.find((section) => section.id === sectionId)

const profileOf = (doc: ResumeDoc, sectionId: string): ProfileData | null => {
  const section = sectionOf(doc, sectionId)
  return section && section.kind === 'profile' ? section.data : null
}

const groupOf = (doc: ResumeDoc, sectionId: string, groupId: string): SkillGroup | null => {
  const section = sectionOf(doc, sectionId)
  if (!section || section.kind !== 'skills') return null
  return section.data.groups.find((group) => group.id === groupId) ?? null
}

/**
 * Entri pemilik field, dibaca dari dokumen. `null` untuk bagian non-entri dan
 * untuk entri maya (kerangka guide pada bagian yang masih kosong).
 */
export const entryRecordOf = (
  doc: ResumeDoc,
  sectionId: string,
  entryId: string,
): Record<string, unknown> | null => {
  if (entryId === GUIDE_ENTRY_ID) return null
  const section = sectionOf(doc, sectionId)
  if (!section || !('entries' in section.data)) return null
  const entries = section.data.entries as Record<string, unknown>[]
  return entries.find((entry) => String(entry.id) === entryId) ?? null
}

/** Nilai field saat ini — dibaca dari store, bukan dari `textContent` (D8). */
export const readCanvasFieldValue = (doc: ResumeDoc, target: CanvasFieldTarget): string => {
  switch (target.kind) {
    case 'profile': {
      const profile = profileOf(doc, target.sectionId)
      return profile ? (profile[target.field] ?? '') : ''
    }
    case 'profile-link': {
      const profile = profileOf(doc, target.sectionId)
      return profile?.links[target.index]?.url ?? ''
    }
    case 'summary': {
      const section = sectionOf(doc, target.sectionId)
      return section && section.kind === 'summary' ? section.data.text : ''
    }
    case 'skill-name':
      return groupOf(doc, target.sectionId, target.groupId)?.name ?? ''
    case 'skill-items':
      return (groupOf(doc, target.sectionId, target.groupId)?.items ?? []).join(', ')
    case 'entry-text': {
      const entry = entryRecordOf(doc, target.sectionId, target.entryId)
      const value = entry?.[target.field]
      return typeof value === 'string' ? value : ''
    }
    case 'entry-bullet': {
      const list = bulletListKeyOf(target.entryKind)
      if (!list) return ''
      const entry = entryRecordOf(doc, target.sectionId, target.entryId)
      const items = Array.isArray(entry?.[list]) ? (entry![list] as unknown[]) : []
      const value = items[target.index]
      return typeof value === 'string' ? value : ''
    }
    case 'entry-dates':
      // Editor tanggal membaca entri langsung (draft range), bukan satu string.
      return ''
  }
}

/**
 * Memecah teks bebas menjadi daftar skill — semantik sama dengan `ChipsInput`
 * (trim, buang yang kosong, tanpa duplikat) dan `skillGroupSchema` (D8).
 */
export const parseChips = (text: string): string[] => {
  const items: string[] = []
  for (const part of text.split(',')) {
    const trimmed = part.trim()
    if (trimmed === '') continue
    if (items.includes(trimmed)) continue
    items.push(trimmed)
  }
  return items
}

/**
 * Nilai yang akan ditulis ke dokumen. Tautan dinormalkan seperti di form
 * (tanpa scheme → `https://`); field lain ditulis apa adanya supaya dokumen
 * hasil kanvas identik dengan dokumen hasil form (Gate C3).
 */
export const normalizeCanvasValue = (target: CanvasFieldTarget, raw: string): string => {
  if (target.kind === 'profile-link') return normalizeUrlInput(raw)
  return raw
}
