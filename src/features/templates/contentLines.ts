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
export type EntryContent = { title: string; meta: string; bodyLines: DocLine[] }

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
      return {
        title: join([item.role, item.company], ' — '),
        meta: join([item.location, range(item.startDate, item.endDate, item.current, lang)]),
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
        bodyLines: bullets(item.notes),
      }
    }
    case 'projects': {
      const item = as<ProjectEntry>(entry)
      return {
        title: join([item.name, item.role], ' — '),
        meta: join([item.url, range(item.startDate, item.endDate, false, lang)]),
        bodyLines: [...bullets(item.bullets), ...stackLine(item.stack)],
      }
    }
    case 'certifications': {
      const item = as<CertificationEntry>(entry)
      return {
        title: item.name,
        meta: join([item.issuer, formatMonth(item.issuedAt, lang), item.credentialId]),
        bodyLines: plain(item.url),
      }
    }
    case 'languages': {
      const item = as<LanguageEntry>(entry)
      return { title: item.name, meta: item.proficiency, bodyLines: [] }
    }
    case 'awards': {
      const item = as<AwardEntry>(entry)
      return {
        title: item.title,
        meta: join([item.issuer, formatMonth(item.awardedAt, lang)]),
        bodyLines: plain(item.description),
      }
    }
    default: {
      const item = as<VolunteeringEntry>(entry)
      return {
        title: join([item.role, item.organization], ' — '),
        meta: range(item.startDate, item.endDate, item.current, lang),
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
