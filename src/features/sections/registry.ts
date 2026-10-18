import {
  AlignLeft,
  BadgeCheck,
  Briefcase,
  FolderGit2,
  GraduationCap,
  HeartHandshake,
  Languages,
  Trophy,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { TranslationKey } from '@/lib/i18n'
import type { SectionData, SectionDataOf, SectionKind } from '@/schema/resume'
import { createEmptySectionData, sectionSchema } from '@/schema/resume'

export type CompletenessResult = {
  dots: 0 | 1 | 2 | 3
  filled: number
  total: number
  isComplete: boolean
}

export type SectionRegistryEntry = {
  kind: SectionKind
  labelId: TranslationKey
  descriptionId: TranslationKey
  hintId: TranslationKey
  icon: LucideIcon
  defaultData(): SectionData
  isComplete(data: SectionData): boolean
  getCompleteness(data: SectionData): CompletenessResult
  requiredFields: readonly string[]
  maxEntries?: number
}

function defineSection<K extends SectionKind>(entry: {
  kind: K
  labelId: TranslationKey
  descriptionId: TranslationKey
  hintId: TranslationKey
  icon: LucideIcon
  defaultData: () => SectionDataOf<K>
  isComplete: (data: SectionDataOf<K>) => boolean
  getCompleteness: (data: SectionDataOf<K>) => CompletenessResult
  requiredFields: readonly string[]
  maxEntries?: number
}): SectionRegistryEntry {
  return entry as unknown as SectionRegistryEntry
}

const nonEmpty = (value: string): boolean => value.trim().length > 0

const computeDots = (filled: number, total: number, isComplete: boolean): 0 | 1 | 2 | 3 => {
  if (filled <= 0 || total <= 0) return 0
  if (isComplete || filled >= total) return 3
  const ratio = filled / total
  if (ratio >= 0.5) return 2
  return 1
}

export const sectionRegistry: Record<SectionKind, SectionRegistryEntry> = {
  profile: defineSection({
    kind: 'profile',
    labelId: 'section.profile',
    descriptionId: 'section.desc.profile',
    hintId: 'section.hint.profile',
    icon: User,
    defaultData: () => createEmptySectionData('profile'),
    isComplete: (data) =>
      nonEmpty(data.fullName) &&
      nonEmpty(data.email) &&
      nonEmpty(data.phone) &&
      nonEmpty(data.headline),
    getCompleteness: (data) => {
      const total = 4
      const filled =
        (nonEmpty(data.fullName) ? 1 : 0) +
        (nonEmpty(data.headline) ? 1 : 0) +
        (nonEmpty(data.email) ? 1 : 0) +
        (nonEmpty(data.phone) ? 1 : 0)
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['fullName', 'headline', 'email', 'phone'],
  }),
  summary: defineSection({
    kind: 'summary',
    labelId: 'section.summary',
    descriptionId: 'section.desc.summary',
    hintId: 'section.hint.summary',
    icon: AlignLeft,
    defaultData: () => createEmptySectionData('summary'),
    isComplete: (data) => nonEmpty(data.text),
    getCompleteness: (data) => {
      const total = 1
      const filled = nonEmpty(data.text) ? 1 : 0
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['text'],
  }),
  experience: defineSection({
    kind: 'experience',
    labelId: 'section.experience',
    descriptionId: 'section.desc.experience',
    hintId: 'section.hint.experience',
    icon: Briefcase,
    defaultData: () => createEmptySectionData('experience'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) =>
          nonEmpty(entry.role) &&
          nonEmpty(entry.company) &&
          nonEmpty(entry.startDate) &&
          (entry.current || nonEmpty(entry.endDate)) &&
          entry.bullets.some(nonEmpty),
      ),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 5, isComplete: false }
      }
      const total = data.entries.length * 5
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.role)) filled += 1
        if (nonEmpty(entry.company)) filled += 1
        if (nonEmpty(entry.startDate)) filled += 1
        if (entry.current || nonEmpty(entry.endDate)) filled += 1
        if (entry.bullets.some(nonEmpty)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['role', 'company', 'startDate', 'endDate', 'bullets'],
  }),
  education: defineSection({
    kind: 'education',
    labelId: 'section.education',
    descriptionId: 'section.desc.education',
    hintId: 'section.hint.education',
    icon: GraduationCap,
    defaultData: () => createEmptySectionData('education'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) =>
          nonEmpty(entry.degree) && nonEmpty(entry.institution) && nonEmpty(entry.startDate),
      ),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 3, isComplete: false }
      }
      const total = data.entries.length * 3
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.degree)) filled += 1
        if (nonEmpty(entry.institution)) filled += 1
        if (nonEmpty(entry.startDate)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['degree', 'institution', 'startDate'],
  }),
  skills: defineSection({
    kind: 'skills',
    labelId: 'section.skills',
    descriptionId: 'section.desc.skills',
    hintId: 'section.hint.skills',
    icon: Wrench,
    defaultData: () => createEmptySectionData('skills'),
    isComplete: (data) =>
      data.groups.length > 0 &&
      data.groups.every((group) => nonEmpty(group.name) && group.items.length > 0),
    getCompleteness: (data) => {
      if (data.groups.length === 0) {
        return { dots: 0, filled: 0, total: 2, isComplete: false }
      }
      const total = data.groups.length * 2
      let filled = 0
      for (const group of data.groups) {
        if (nonEmpty(group.name)) filled += 1
        if (group.items.length > 0) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['name', 'items'],
  }),
  projects: defineSection({
    kind: 'projects',
    labelId: 'section.projects',
    descriptionId: 'section.desc.projects',
    hintId: 'section.hint.projects',
    icon: FolderGit2,
    defaultData: () => createEmptySectionData('projects'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every((entry) => nonEmpty(entry.name) && nonEmpty(entry.startDate)),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 2, isComplete: false }
      }
      const total = data.entries.length * 2
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.name)) filled += 1
        if (nonEmpty(entry.startDate)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['name', 'startDate'],
  }),
  certifications: defineSection({
    kind: 'certifications',
    labelId: 'section.certifications',
    descriptionId: 'section.desc.certifications',
    hintId: 'section.hint.certifications',
    icon: BadgeCheck,
    defaultData: () => createEmptySectionData('certifications'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) => nonEmpty(entry.name) && nonEmpty(entry.issuer) && nonEmpty(entry.issuedAt),
      ),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 3, isComplete: false }
      }
      const total = data.entries.length * 3
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.name)) filled += 1
        if (nonEmpty(entry.issuer)) filled += 1
        if (nonEmpty(entry.issuedAt)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['name', 'issuer', 'issuedAt'],
  }),
  languages: defineSection({
    kind: 'languages',
    labelId: 'section.languages',
    descriptionId: 'section.desc.languages',
    hintId: 'section.hint.languages',
    icon: Languages,
    defaultData: () => createEmptySectionData('languages'),
    isComplete: (data) =>
      data.entries.length > 0 && data.entries.every((entry) => nonEmpty(entry.name)),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 2, isComplete: false }
      }
      const total = data.entries.length * 2
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.name)) filled += 1
        if (nonEmpty(entry.proficiency)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['name', 'proficiency'],
  }),
  awards: defineSection({
    kind: 'awards',
    labelId: 'section.awards',
    descriptionId: 'section.desc.awards',
    hintId: 'section.hint.awards',
    icon: Trophy,
    defaultData: () => createEmptySectionData('awards'),
    isComplete: (data) =>
      data.entries.length > 0 && data.entries.every((entry) => nonEmpty(entry.title)),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 1, isComplete: false }
      }
      const total = data.entries.length
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.title)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['title'],
  }),
  volunteering: defineSection({
    kind: 'volunteering',
    labelId: 'section.volunteering',
    descriptionId: 'section.desc.volunteering',
    hintId: 'section.hint.volunteering',
    icon: HeartHandshake,
    defaultData: () => createEmptySectionData('volunteering'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) =>
          nonEmpty(entry.role) && nonEmpty(entry.organization) && nonEmpty(entry.startDate),
      ),
    getCompleteness: (data) => {
      if (data.entries.length === 0) {
        return { dots: 0, filled: 0, total: 3, isComplete: false }
      }
      const total = data.entries.length * 3
      let filled = 0
      for (const entry of data.entries) {
        if (nonEmpty(entry.role)) filled += 1
        if (nonEmpty(entry.organization)) filled += 1
        if (nonEmpty(entry.startDate)) filled += 1
      }
      const complete = filled === total
      return { dots: computeDots(filled, total, complete), filled, total, isComplete: complete }
    },
    requiredFields: ['role', 'organization', 'startDate'],
  }),
}

export function getSectionCompleteness(section: {
  kind: SectionKind
  data: SectionData
}): CompletenessResult {
  const reg = sectionRegistry[section.kind]
  return reg.getCompleteness(section.data)
}

/**
 * T3.7 — jumlah masalah validasi Zod pada satu bagian. Kosong dianggap sah
 * (draft); badge hanya muncul untuk isi yang salah format.
 */
export function countSectionIssues(section: {
  id: string
  kind: SectionKind
  visible: boolean
  data: unknown
}): number {
  const result = sectionSchema.safeParse(section)
  return result.success ? 0 : result.error.issues.length
}

export function calculateTotalCompleteness(
  sections: readonly { kind: SectionKind; visible: boolean; data: SectionData }[],
): number {
  const visibleSections = sections.filter((s) => s.visible)
  if (visibleSections.length === 0) return 0
  let totalFilled = 0
  let totalRequired = 0
  for (const s of visibleSections) {
    const res = getSectionCompleteness(s)
    totalFilled += res.filled
    totalRequired += res.total
  }
  if (totalRequired === 0) return 0
  return Math.min(100, Math.max(0, Math.round((totalFilled / totalRequired) * 100)))
}
