import { formatMonth } from '@/lib/dates'
import { t, type Lang } from '@/lib/i18n'
import { sectionRegistry } from '@/features/sections/registry'
import type {
  AwardEntry,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  ProfileData,
  ProjectEntry,
  SectionInstance,
  SkillGroup,
  VolunteeringEntry,
} from '@/types/resume'

/**
 * Model isi dokumen: satu tempat yang memutuskan teks mana menjadi baris dokumen
 * dan baris mana yang bergaya bullet. Dipakai estimator pagination DAN renderer
 * layar (juga renderer PDF Fase 5), jadi baris yang dihitung selalu baris yang digambar.
 */

export type EntriesSection = Exclude<SectionInstance, { kind: 'profile' | 'summary' | 'skills' }>
export type EntriesSectionKind = EntriesSection['kind']
export type DocLine = { text: string; bullet: boolean }

/**
 * `meta` = satu baris meta utuh (lokasi · tanggal) untuk layout next-line.
 * `metaNoDates` + `dates` = potongannya untuk layout tanggal-kanan (T6.2):
 * tanggal naik ke ujung kanan baris judul, sisanya tetap di baris meta.
 */
export type EntryContent = {
  title: string
  meta: string
  metaNoDates: string
  dates: string
  bodyLines: DocLine[]
}

const join = (parts: (string | undefined)[], separator = ' · '): string =>
  parts.filter((part) => Boolean(part)).join(separator)

const range = (start: string, end: string, current: boolean, lang: Lang): string => {
  const from = formatMonth(start, lang)
  const to = current ? t('experience.presentChip') : formatMonth(end, lang)
  return join([from, to], ' – ')
}

const bullets = (items: readonly string[]): DocLine[] =>
  items.filter((item) => item.trim() !== '').map((text) => ({ text, bullet: true }))

const plain = (text: string): DocLine[] => (text.trim() === '' ? [] : [{ text, bullet: false }])

const stackLine = (stack: readonly string[]): DocLine[] =>
  stack.length === 0 ? [] : plain(`${t('doc.stackPrefix')}${stack.join(', ')}`)

export const sectionLabel = (kind: SectionInstance['kind']): string =>
  t(sectionRegistry[kind].labelId)

const as = <T>(value: unknown): T => value as T

// Entri bersifat immutable (store membuat objek baru hanya untuk entri yang
// berubah), jadi hasil pemetaan entri → baris bisa di-cache per objek. Tanpa ini,
// setiap ketikan menghitung ulang judul/meta/tanggal untuk semua blok.
const cache = new WeakMap<object, { lang: Lang; content: EntryContent }>()

export function entryContentOf(
  kind: EntriesSectionKind,
  entry: Record<string, unknown>,
  lang: Lang,
): EntryContent {
  const cached = cache.get(entry)
  if (cached?.lang === lang) return cached.content
  const content = buildEntryContent(kind, entry, lang)
  cache.set(entry, { lang, content })
  return content
}

function buildEntryContent(
  kind: EntriesSectionKind,
  entry: Record<string, unknown>,
  lang: Lang,
): EntryContent {
  switch (kind) {
    case 'experience': {
      const item = as<ExperienceEntry>(entry)
      const dates = range(item.startDate, item.endDate, item.current, lang)
      return {
        title: join([item.role, item.company], ' — '),
        meta: join([item.location, dates]),
        metaNoDates: item.location,
        dates,
        bodyLines: [...bullets(item.bullets), ...stackLine(item.stack)],
      }
    }
    case 'education': {
      const item = as<EducationEntry>(entry)
      return {
        title: join([item.degree, item.field], ', '),
        meta: join([
          item.institution,
          item.location,
          item.gpa ? `${t('doc.gpaPrefix')}${item.gpa}` : '',
        ]),
        metaNoDates: join([
          item.institution,
          item.location,
          item.gpa ? `${t('doc.gpaPrefix')}${item.gpa}` : '',
        ]),
        dates: '',
        bodyLines: bullets(item.notes),
      }
    }
    case 'projects': {
      const item = as<ProjectEntry>(entry)
      const dates = range(item.startDate, item.endDate, false, lang)
      return {
        title: join([item.name, item.role], ' — '),
        meta: join([item.url, dates]),
        metaNoDates: item.url,
        dates,
        bodyLines: [...bullets(item.bullets), ...stackLine(item.stack)],
      }
    }
    case 'certifications': {
      const item = as<CertificationEntry>(entry)
      const dates = formatMonth(item.issuedAt, lang)
      return {
        title: item.name,
        meta: join([item.issuer, dates, item.credentialId]),
        metaNoDates: join([item.issuer, item.credentialId]),
        dates,
        bodyLines: plain(item.url),
      }
    }
    case 'languages': {
      const item = as<LanguageEntry>(entry)
      return {
        title: item.name,
        meta: item.proficiency,
        metaNoDates: item.proficiency,
        dates: '',
        bodyLines: [],
      }
    }
    case 'awards': {
      const item = as<AwardEntry>(entry)
      const dates = formatMonth(item.awardedAt, lang)
      return {
        title: item.title,
        meta: join([item.issuer, dates]),
        metaNoDates: item.issuer,
        dates,
        bodyLines: plain(item.description),
      }
    }
    default: {
      const item = as<VolunteeringEntry>(entry)
      const dates = range(item.startDate, item.endDate, item.current, lang)
      return {
        title: join([item.role, item.organization], ' — '),
        meta: dates,
        metaNoDates: '',
        dates,
        bodyLines: bullets(item.bullets),
      }
    }
  }
}

export const isBlankEntry = (content: EntryContent): boolean =>
  content.title.trim() === '' && content.meta.trim() === '' && content.bodyLines.length === 0

export const profileContact = (data: ProfileData): string[] => [
  data.email,
  data.phone,
  data.location,
  ...data.links.map((link) => link.url || link.label),
]

export const skillGroupLines = (group: SkillGroup): string[] =>
  [group.name, group.items.length > 0 ? group.items.join(', ') : ''].filter(
    (line) => line.trim() !== '',
  )

export const summaryText = (section: SectionInstance): string =>
  section.kind === 'summary' ? section.data.text : ''

export const entriesOf = (section: EntriesSection): Record<string, unknown>[] =>
  section.data.entries as unknown as Record<string, unknown>[]
