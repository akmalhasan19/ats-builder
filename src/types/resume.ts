export type ISOYearMonth = string // '2024-03'

export type PageSettings = {
  size: 'A4' | 'LETTER'
  marginMm: number // override per-template, default dari spec
  showPageNumbers: boolean
}

export type ThemeTokens = {
  accentHex: string | null // null = hitam-putih murni (paling ATS-safe)
  fontScale: number // 0.9 | 0.95 | 1 | 1.05 | 1.1
}

export type ResumeDoc = {
  id: string
  title: string
  templateId: TemplateId
  schemaVersion: number
  settings: { page: PageSettings; language: 'id' | 'en' }
  theme: ThemeTokens
  sections: SectionInstance[] // URUTAN = urutan render
  jobDescription: string | null // untuk keyword matcher (Fase 7/12)
  meta: { createdAt: number; updatedAt: number; lastCheckedAt: number | null }
}

export type SectionInstance =
  | { id: string; kind: 'profile'; visible: boolean; data: ProfileData }
  | { id: string; kind: 'summary'; visible: boolean; data: { text: string } }
  | { id: string; kind: 'experience'; visible: boolean; data: { entries: ExperienceEntry[] } }
  | { id: string; kind: 'education'; visible: boolean; data: { entries: EducationEntry[] } }
  | { id: string; kind: 'skills'; visible: boolean; data: { groups: SkillGroup[] } }
  | { id: string; kind: 'projects'; visible: boolean; data: { entries: ProjectEntry[] } }
  | {
      id: string
      kind: 'certifications'
      visible: boolean
      data: { entries: CertificationEntry[] }
    }
  | { id: string; kind: 'languages'; visible: boolean; data: { entries: LanguageEntry[] } }
  | { id: string; kind: 'awards'; visible: boolean; data: { entries: AwardEntry[] } }
  | { id: string; kind: 'volunteering'; visible: boolean; data: { entries: VolunteeringEntry[] } }

export type ProfileData = {
  fullName: string
  headline: string // headline = "Software Engineer"
  email: string
  phone: string
  location: string
  links: { label: string; url: string }[] // LinkedIn, GitHub, Portfolio
  photoEnabled: false // SELALU false — foto merusak parsing ATS
}

export type ExperienceEntry = {
  id: string
  role: string
  company: string
  location: string
  startDate: ISOYearMonth | ''
  endDate: ISOYearMonth | ''
  current: boolean
  bullets: string[]
  stack: string[] // opsional, dirender sebagai teks biasa
}

export type EducationEntry = {
  id: string
  degree: string
  field: string
  institution: string
  location: string
  startDate: ISOYearMonth | ''
  endDate: ISOYearMonth | ''
  gpa: string
  notes: string[]
}

export type SkillGroup = { id: string; name: string; items: string[] } // tanpa level/bar

export type ProjectEntry = {
  id: string
  name: string
  role: string
  url: string
  startDate: ISOYearMonth | ''
  endDate: ISOYearMonth | ''
  bullets: string[]
  stack: string[]
}
export type CertificationEntry = {
  id: string
  name: string
  issuer: string
  issuedAt: ISOYearMonth | ''
  credentialId: string
  url: string
}
export type LanguageEntry = {
  id: string
  name: string
  proficiency: 'Native' | 'Fluent' | 'Professional' | 'Intermediate' | 'Basic'
}
export type AwardEntry = {
  id: string
  title: string
  issuer: string
  awardedAt: ISOYearMonth | ''
  description: string
}
export type VolunteeringEntry = {
  id: string
  role: string
  organization: string
  startDate: ISOYearMonth | ''
  endDate: ISOYearMonth | ''
  current: boolean
  bullets: string[]
}

export type TemplateId = 'classic-ats' | 'ledger' | 'executive' | 'minimal' | 'technician'
