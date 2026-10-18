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
import { createEmptySectionData } from '@/schema/resume'

export type SectionRegistryEntry = {
  kind: SectionKind
  labelId: TranslationKey
  icon: LucideIcon
  defaultData(): SectionData
  isComplete(data: SectionData): boolean
  requiredFields: readonly string[]
  maxEntries?: number
}

function defineSection<K extends SectionKind>(entry: {
  kind: K
  labelId: TranslationKey
  icon: LucideIcon
  defaultData: () => SectionDataOf<K>
  isComplete: (data: SectionDataOf<K>) => boolean
  requiredFields: readonly string[]
  maxEntries?: number
}): SectionRegistryEntry {
  return entry
}

const nonEmpty = (value: string): boolean => value.trim().length > 0

export const sectionRegistry: Record<SectionKind, SectionRegistryEntry> = {
  profile: defineSection({
    kind: 'profile',
    labelId: 'section.profile',
    icon: User,
    defaultData: () => createEmptySectionData('profile'),
    isComplete: (data) =>
      nonEmpty(data.fullName) &&
      nonEmpty(data.email) &&
      nonEmpty(data.phone) &&
      nonEmpty(data.headline),
    requiredFields: ['fullName', 'headline', 'email', 'phone'],
  }),
  summary: defineSection({
    kind: 'summary',
    labelId: 'section.summary',
    icon: AlignLeft,
    defaultData: () => createEmptySectionData('summary'),
    isComplete: (data) => nonEmpty(data.text),
    requiredFields: ['text'],
  }),
  experience: defineSection({
    kind: 'experience',
    labelId: 'section.experience',
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
    requiredFields: ['role', 'company', 'startDate', 'endDate', 'bullets'],
  }),
  education: defineSection({
    kind: 'education',
    labelId: 'section.education',
    icon: GraduationCap,
    defaultData: () => createEmptySectionData('education'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) =>
          nonEmpty(entry.degree) && nonEmpty(entry.institution) && nonEmpty(entry.startDate),
      ),
    requiredFields: ['degree', 'institution', 'startDate'],
  }),
  skills: defineSection({
    kind: 'skills',
    labelId: 'section.skills',
    icon: Wrench,
    defaultData: () => createEmptySectionData('skills'),
    isComplete: (data) =>
      data.groups.length > 0 &&
      data.groups.every((group) => nonEmpty(group.name) && group.items.length > 0),
    requiredFields: ['name', 'items'],
  }),
  projects: defineSection({
    kind: 'projects',
    labelId: 'section.projects',
    icon: FolderGit2,
    defaultData: () => createEmptySectionData('projects'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every((entry) => nonEmpty(entry.name) && nonEmpty(entry.startDate)),
    requiredFields: ['name', 'startDate'],
  }),
  certifications: defineSection({
    kind: 'certifications',
    labelId: 'section.certifications',
    icon: BadgeCheck,
    defaultData: () => createEmptySectionData('certifications'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) => nonEmpty(entry.name) && nonEmpty(entry.issuer) && nonEmpty(entry.issuedAt),
      ),
    requiredFields: ['name', 'issuer', 'issuedAt'],
  }),
  languages: defineSection({
    kind: 'languages',
    labelId: 'section.languages',
    icon: Languages,
    defaultData: () => createEmptySectionData('languages'),
    isComplete: (data) =>
      data.entries.length > 0 && data.entries.every((entry) => nonEmpty(entry.name)),
    requiredFields: ['name', 'proficiency'],
  }),
  awards: defineSection({
    kind: 'awards',
    labelId: 'section.awards',
    icon: Trophy,
    defaultData: () => createEmptySectionData('awards'),
    isComplete: (data) =>
      data.entries.length > 0 && data.entries.every((entry) => nonEmpty(entry.title)),
    requiredFields: ['title'],
  }),
  volunteering: defineSection({
    kind: 'volunteering',
    labelId: 'section.volunteering',
    icon: HeartHandshake,
    defaultData: () => createEmptySectionData('volunteering'),
    isComplete: (data) =>
      data.entries.length > 0 &&
      data.entries.every(
        (entry) =>
          nonEmpty(entry.role) && nonEmpty(entry.organization) && nonEmpty(entry.startDate),
      ),
    requiredFields: ['role', 'organization', 'startDate'],
  }),
}
