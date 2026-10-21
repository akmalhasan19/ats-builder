import { formatMonth } from '@/lib/dates'
import { t, tMaybe, type Lang } from '@/lib/i18n'
import type { ProfileData, SkillGroup, TemplateId } from '@/types/resume'
import type { EntriesSectionKind } from './contentLines'
import type { TemplateSpec } from './specs'

/**
 * Segmentasi per field khusus layar (D4).
 *
 * `contentLines.ts` menyusun satu string komposit per baris ("role — company",
 * "email · telepon · lokasi"). String itu tidak bisa dipetakan balik ke field
 * mana yang diklik user, jadi modul ini membangun ULANG baris yang sama dari
 * dokumen — bukan dari string komposit — sambil mempertahankan setiap bagian
 * sebagai segmen tersendiri. Urutan teks + separator hasilnya identik dengan
 * `contentLines` (dijaga unit test), sehingga tinggi terukur dan paritas
 * halaman tidak berubah.
 *
 * Modul ini TIDAK mengubah `contentLines.ts`: renderer PDF tetap memakai string
 * komposit (D4/D12), jadi guide tidak pernah masuk PDF.
 */

/** Field yang punya guide placeholder di atas kertas (D5, matriks §4). */
export type GuideId =
  | 'fullName'
  | 'headline'
  | 'email'
  | 'phone'
  | 'location'
  | 'link'
  | 'summary'
  | 'skillGroupName'
  | 'skillGroupItems'
  | 'role'
  | 'company'
  | 'degree'
  | 'field'
  | 'institution'
  | 'name'
  | 'issuer'
  | 'title'
  | 'organization'
  | 'dates'
  | 'bullet'

/**
 * Teks pemandu sebuah field (D5). Struktur override per template (OQ2):
 * `canvas.guide.<templateId>.<id>` dibaca lebih dulu; bila belum diisi, dipakai
 * set netral `canvas.guide.<id>`.
 */
export const guideTextOf = (guideId: GuideId, templateId: TemplateId): string => {
  const override = tMaybe(`canvas.guide.${templateId}.${guideId}`)
  return override ?? t(`canvas.guide.${guideId}`)
}

/** Nama field untuk aria-label segmen (D11). */
export const fieldLabelOf = (guideId: GuideId): string => t(`canvas.field.${guideId}`)

/** Satu bagian field di dalam baris dokumen. */
export type FieldSegment = {
  /** Path model menuju field; string kosong = teks biasa, bukan field. */
  fieldPath: string
  /** Nilai field; string kosong = field kosong → guide yang tampil. */
  text: string
  /** Guide untuk field kosong; `undefined` = segmen bukan field yang bisa diedit. */
  guideId?: GuideId
}

/** Peran visual baris — menentukan gaya dari `screenStyles`. */
export type SegmentSlot = 'name' | 'headline' | 'contact' | 'title' | 'dates' | 'meta' | 'body'

/** Satu baris dokumen: segmen-segmen field + pemisah literalnya. */
export type SegmentGroup = {
  slot: SegmentSlot
  /** Baris visual di dalam blok (entry-head tanggal-kanan: judul & tanggal sebaris). */
  line: number
  /** Literal pemisah antar segmen; identik dengan pemisah di `contentLines`. */
  separator: string
  segments: FieldSegment[]
}

/**
 * String komposit sebuah baris — sama persis dengan baris yang digambar
 * `contentLines` (field kosong dibuang, pemisah hanya di antara isi yang ada).
 */
export const compositeOf = (group: SegmentGroup): string =>
  group.segments
    .filter((segment) => segment.text !== '')
    .map((segment) => segment.text)
    .join(group.separator)

/** Segmen yang tampil sesuatu di layar: nilai terisi atau guide. */
export const displaysContent = (segment: FieldSegment): boolean =>
  segment.text !== '' || segment.guideId !== undefined

/** Teks yang tampil untuk sebuah segmen: nilai, atau guide bila kosong. */
export const displayTextOf = (segment: FieldSegment, templateId: TemplateId): string => {
  if (segment.text !== '') return segment.text
  return segment.guideId ? guideTextOf(segment.guideId, templateId) : ''
}

/**
 * Baris gabungan yang tampil di layar. Pemisah literal hanya muncul di antara
 * dua bagian yang sama-sama menampilkan sesuatu — jadi baris kosong tidak
 * pernah meninggalkan "·" menggantung, dan bagian yang tidak ditampilkan
 * (mis. IPK kosong) tidak memutus baris.
 */
export const displayLineOf = (group: SegmentGroup, templateId: TemplateId): string => {
  const parts: string[] = []
  group.segments.forEach((segment) => {
    const text = displayTextOf(segment, templateId)
    if (text === '') return
    if (parts.length > 0) parts.push(group.separator)
    parts.push(text)
  })
  return parts.join('')
}

const seg = (fieldPath: string, text: string, guideId?: GuideId): FieldSegment => ({
  fieldPath,
  text,
  guideId,
})

const group = (
  slot: SegmentSlot,
  line: number,
  separator: string,
  segments: FieldSegment[],
): SegmentGroup => ({ slot, line, separator, segments })

/* --------------------------------------------------------------------------
 * Header (profil)
 * ----------------------------------------------------------------------- */

export const headerGroups = (profile: ProfileData | null, spec: TemplateSpec): SegmentGroup[] => [
  group('name', 0, '', [seg('profile.fullName', profile?.fullName ?? '', 'fullName')]),
  group('headline', 1, '', [seg('profile.headline', profile?.headline ?? '', 'headline')]),
  group('contact', 2, spec.contactStyle.separator, [
    seg('profile.email', profile?.email ?? '', 'email'),
    seg('profile.phone', profile?.phone ?? '', 'phone'),
    seg('profile.location', profile?.location ?? '', 'location'),
    ...(profile?.links ?? []).map((link, index) =>
      seg(`profile.links.${index}.url`, link.url || link.label, 'link'),
    ),
  ]),
]

/* --------------------------------------------------------------------------
 * Ringkasan
 * ----------------------------------------------------------------------- */

export const summaryGroups = (text: string): SegmentGroup[] => [
  group('body', 0, '', [seg('summary.text', text, 'summary')]),
]

/* --------------------------------------------------------------------------
 * Kelompok keahlian
 * ----------------------------------------------------------------------- */

export const skillGroupGroups = (
  skillGroup: SkillGroup | null,
  groupId: string,
): SegmentGroup[] => [
  group('title', 0, '', [
    seg(`skills.groups.${groupId}.name`, skillGroup?.name ?? '', 'skillGroupName'),
  ]),
  group('body', 1, '', [
    seg(`skills.groups.${groupId}.items`, (skillGroup?.items ?? []).join(', '), 'skillGroupItems'),
  ]),
]

/* --------------------------------------------------------------------------
 * Kepala entri (judul, meta, tanggal)
 * ----------------------------------------------------------------------- */

type EntryRecord = Record<string, unknown>

/** Bagian field di dalam baris; `guide` kosong = bukan field editable. */
type Part = { field: string; text: string; guide?: GuideId }

type EntryParts = {
  /** Pemisah antar bagian judul (identik dengan `join` di `contentLines`). */
  titleSeparator: string
  title: Part[]
  /** Meta tanpa tanggal — dipakai layout tanggal-kanan. */
  metaNoDates: Part[]
  /** Meta beserta tanggal — dipakai layout tanggal-baris-berikutnya. */
  meta: Part[]
  /** Bagian tanggal, kalau dokumen menampilkannya. */
  dates: Part | null
}

const textOf = (entry: EntryRecord | null, key: string): string => {
  const value = entry?.[key]
  return typeof value === 'string' ? value : ''
}

const rangeText = (start: string, end: string, current: boolean, lang: Lang): string => {
  const from = formatMonth(start, lang)
  const to = current ? t('experience.presentChip') : formatMonth(end, lang)
  return [from, to].filter((part) => Boolean(part)).join(' – ')
}

/** Tanggal yang digambar dokumen untuk tiap jenis entri (ikut `contentLines`). */
const datesTextOf = (kind: EntriesSectionKind, entry: EntryRecord | null, lang: Lang): string => {
  switch (kind) {
    case 'experience':
      return rangeText(
        textOf(entry, 'startDate'),
        textOf(entry, 'endDate'),
        entry?.current === true,
        lang,
      )
    case 'projects':
      return rangeText(textOf(entry, 'startDate'), textOf(entry, 'endDate'), false, lang)
    case 'volunteering':
      return rangeText(
        textOf(entry, 'startDate'),
        textOf(entry, 'endDate'),
        entry?.current === true,
        lang,
      )
    case 'certifications':
      return formatMonth(textOf(entry, 'issuedAt'), lang)
    case 'awards':
      return formatMonth(textOf(entry, 'awardedAt'), lang)
    default:
      return ''
  }
}

/**
 * Bagian-bagian baris entri, diturunkan dari dokumen. Susunannya mengikuti
 * `buildEntryContent` di `contentLines.ts` — pemisahnya identik, dan unit test
 * `fieldSegments.test.ts` menjaga kedua implementasi tetap sama.
 */
const entryParts = (
  kind: EntriesSectionKind,
  entry: EntryRecord | null,
  base: string,
  datesText: string,
): EntryParts => {
  // Tanggal hanya jadi baris tersendiri kalau dokumen memang menampilkannya
  // (pendidikan & bahasa tidak menampilkannya sama sekali).
  const hasDates =
    kind === 'experience' ||
    kind === 'projects' ||
    kind === 'certifications' ||
    kind === 'awards' ||
    kind === 'volunteering'
  const dates: Part | null = hasDates
    ? { field: `${base}.dates`, text: datesText, guide: 'dates' }
    : null
  switch (kind) {
    case 'experience':
      return {
        titleSeparator: ' — ',
        title: [
          { field: `${base}.role`, text: textOf(entry, 'role'), guide: 'role' },
          { field: `${base}.company`, text: textOf(entry, 'company'), guide: 'company' },
        ],
        metaNoDates: [
          { field: `${base}.location`, text: textOf(entry, 'location'), guide: 'location' },
        ],
        meta: [
          { field: `${base}.location`, text: textOf(entry, 'location'), guide: 'location' },
          ...(dates ? [dates] : []),
        ],
        dates,
      }
    case 'education':
      return {
        titleSeparator: ', ',
        title: [
          { field: `${base}.degree`, text: textOf(entry, 'degree'), guide: 'degree' },
          { field: `${base}.field`, text: textOf(entry, 'field'), guide: 'field' },
        ],
        metaNoDates: [
          {
            field: `${base}.institution`,
            text: textOf(entry, 'institution'),
            guide: 'institution',
          },
          { field: `${base}.location`, text: textOf(entry, 'location'), guide: 'location' },
          {
            field: '',
            text: textOf(entry, 'gpa') ? `${t('doc.gpaPrefix')}${textOf(entry, 'gpa')}` : '',
          },
        ],
        meta: [
          {
            field: `${base}.institution`,
            text: textOf(entry, 'institution'),
            guide: 'institution',
          },
          { field: `${base}.location`, text: textOf(entry, 'location'), guide: 'location' },
          {
            field: '',
            text: textOf(entry, 'gpa') ? `${t('doc.gpaPrefix')}${textOf(entry, 'gpa')}` : '',
          },
        ],
        dates: null,
      }
    case 'projects':
      return {
        titleSeparator: ' — ',
        title: [
          { field: `${base}.name`, text: textOf(entry, 'name'), guide: 'name' },
          { field: `${base}.role`, text: textOf(entry, 'role'), guide: 'role' },
        ],
        metaNoDates: [{ field: '', text: textOf(entry, 'url') }],
        meta: [{ field: '', text: textOf(entry, 'url') }, ...(dates ? [dates] : [])],
        dates,
      }
    case 'certifications':
      return {
        titleSeparator: ' · ',
        title: [{ field: `${base}.name`, text: textOf(entry, 'name'), guide: 'name' }],
        metaNoDates: [
          { field: `${base}.issuer`, text: textOf(entry, 'issuer'), guide: 'issuer' },
          { field: '', text: textOf(entry, 'credentialId') },
        ],
        meta: [
          { field: `${base}.issuer`, text: textOf(entry, 'issuer'), guide: 'issuer' },
          ...(dates ? [dates] : []),
          { field: '', text: textOf(entry, 'credentialId') },
        ],
        dates,
      }
    case 'languages':
      return {
        titleSeparator: ' · ',
        title: [{ field: `${base}.name`, text: textOf(entry, 'name'), guide: 'name' }],
        metaNoDates: [{ field: '', text: textOf(entry, 'proficiency') }],
        meta: [{ field: '', text: textOf(entry, 'proficiency') }],
        dates: null,
      }
    case 'awards':
      return {
        titleSeparator: ' · ',
        title: [{ field: `${base}.title`, text: textOf(entry, 'title'), guide: 'title' }],
        metaNoDates: [{ field: `${base}.issuer`, text: textOf(entry, 'issuer'), guide: 'issuer' }],
        meta: [
          { field: `${base}.issuer`, text: textOf(entry, 'issuer'), guide: 'issuer' },
          ...(dates ? [dates] : []),
        ],
        dates,
      }
    default:
      return {
        titleSeparator: ' — ',
        title: [
          { field: `${base}.role`, text: textOf(entry, 'role'), guide: 'role' },
          {
            field: `${base}.organization`,
            text: textOf(entry, 'organization'),
            guide: 'organization',
          },
        ],
        metaNoDates: [],
        meta: [...(dates ? [dates] : [])],
        dates,
      }
  }
}

const toSegment = (part: Part): FieldSegment => seg(part.field, part.text, part.guide)

/**
 * Baris-baris kepala entri. `entry` kosong = entri maya untuk kerangka guide
 * (belum ada entri di dokumen) — path-nya tetap menunjuk entri yang akan dibuat.
 */
export const entryHeadGroups = (
  kind: EntriesSectionKind,
  entry: EntryRecord | null,
  spec: TemplateSpec,
  lang: Lang,
): SegmentGroup[] => {
  const id = typeof entry?.id === 'string' ? entry.id : 'new'
  const base = `entries.${kind}.${id}`
  const parts = entryParts(kind, entry, base, datesTextOf(kind, entry, lang))
  const right = spec.entryLayout.datePosition === 'right'
  const groups: SegmentGroup[] = [
    group('title', 0, parts.titleSeparator, parts.title.map(toSegment)),
  ]
  if (right) {
    if (parts.dates) groups.push(group('dates', 0, '', [toSegment(parts.dates)]))
    groups.push(group('meta', 1, ' · ', parts.metaNoDates.map(toSegment)))
  } else {
    groups.push(group('meta', 1, ' · ', parts.meta.map(toSegment)))
  }
  return groups
}

/* --------------------------------------------------------------------------
 * Baris entri (bullet & baris bebas)
 * ----------------------------------------------------------------------- */

/** Satu baris isi entri: teks, apakah bertanda bullet, dan indeks modelnya. */
export type EntryBodyLine = {
  text: string
  bullet: boolean
  /** Indeks bullet di model; `null` untuk baris bebas (stack, url, deskripsi). */
  modelIndex: number | null
}

/**
 * Nama array bullet pada model entri. Pendidikan memakai `notes`, sertifikasi /
 * bahasa / penghargaan tidak punya bullet (barisnya teks bebas milik field lain
 * dan tidak editable di kanvas), sisanya memakai `bullets`.
 */
export const entryBulletListKey = (kind: EntriesSectionKind): 'bullets' | 'notes' | null => {
  if (kind === 'education') return 'notes'
  if (kind === 'certifications' || kind === 'languages' || kind === 'awards') return null
  return 'bullets'
}

const rawBulletItems = (kind: EntriesSectionKind, entry: EntryRecord | null): string[] => {
  const list = entryBulletListKey(kind)
  if (!list) return []
  const raw = entry?.[list]
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
}

/**
 * Baris isi entri untuk layar. Sama seperti `bodyLines` milik `contentLines`,
 * kecuali satu hal: bullet kosong **tetap dihitung** di sini.
 *
 * Alasannya (§5.2, D10): ghost row "+ Tambahkan bullet" mendorong slot kosong
 * supaya user langsung punya baris untuk diketik. Slot itu butuh blok sendiri di
 * rencana kanvas, dan kunci blok harus tetap `{sectionId}:{itemId}:l{indeks
 * model}` — satu-satunya angka yang juga bisa diturunkan `canvasFields` dari
 * path field. PDF tidak pernah melihat daftar ini: jalur ekspor tetap memakai
 * `contentLines` yang membuang baris kosong (D12).
 */
export const entryBodyLines = (
  kind: EntriesSectionKind,
  entry: EntryRecord | null,
): EntryBodyLine[] => {
  const lines: EntryBodyLine[] = []
  rawBulletItems(kind, entry).forEach((text, index) => {
    lines.push({ text, bullet: true, modelIndex: index })
  })
  if (kind === 'experience' || kind === 'projects') {
    const stack = Array.isArray(entry?.stack) ? (entry?.stack as unknown[]) : []
    if (stack.length > 0) {
      const names = stack.filter((item): item is string => typeof item === 'string')
      lines.push({
        text: `${t('doc.stackPrefix')}${names.join(', ')}`,
        bullet: false,
        modelIndex: null,
      })
    }
  }
  if (kind === 'certifications') {
    const url = textOf(entry, 'url')
    if (url.trim() !== '') lines.push({ text: url, bullet: false, modelIndex: null })
  }
  if (kind === 'awards') {
    const description = textOf(entry, 'description')
    if (description.trim() !== '')
      lines.push({ text: description, bullet: false, modelIndex: null })
  }
  return lines
}

/**
 * Baris-baris satu blok `entry-line`. `lineIndex` yang tidak tampil sebagai baris
 * berarti blok guide: bullet yang belum ada isinya — slot berikutnya, atau slot
 * bullet kosong yang baru dibuat ghost row (D10).
 */
export const entryLineGroups = (
  kind: EntriesSectionKind,
  entry: EntryRecord | null,
  lineIndex: number,
): SegmentGroup[] => {
  const id = typeof entry?.id === 'string' ? entry.id : 'new'
  const base = `entries.${kind}.${id}`
  const lines = entryBodyLines(kind, entry)
  const line = lines[lineIndex]
  const field = entryBulletListKey(kind)
  if (!line) {
    if (!field) return [group('body', 0, '', [seg('', '')])]
    // Slot bullet yang belum ada sama sekali: path menunjuk indeks berikutnya.
    return [group('body', 0, '', [seg(`${base}.${field}[${lineIndex}]`, '', 'bullet')])]
  }
  if (!line.bullet || field === null) return [group('body', 0, '', [seg('', line.text)])]
  return [group('body', 0, '', [seg(`${base}.${field}[${line.modelIndex}]`, line.text, 'bullet')])]
}
