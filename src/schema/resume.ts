import { z } from 'zod'
import type {
  AwardEntry,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  ISOYearMonth,
  LanguageEntry,
  ProfileData,
  ProjectEntry,
  ResumeDoc,
  SectionInstance,
  VolunteeringEntry,
} from '@/types/resume'

export const CURRENT_SCHEMA_VERSION = 1

export type SectionKind = SectionInstance['kind']
export type SectionData = SectionInstance['data']
export type EntriesSectionKind = Exclude<SectionKind, 'profile' | 'summary' | 'skills'>
export type SectionDataOf<K extends SectionKind> = Extract<SectionInstance, { kind: K }>['data']
export type EntryOf<K extends EntriesSectionKind> = Extract<
  SectionInstance,
  { kind: K }
>['data']['entries'][number]

const YEAR_MONTH_ERROR =
  'Tanggal harus format YYYY-MM. Contoh: 2024-03 (kosong juga diperbolehkan).'
const yearMonth = (): z.ZodType<ISOYearMonth> =>
  z.string().regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/, YEAR_MONTH_ERROR)

const idField = (): z.ZodType<string> => z.string().min(1, 'ID entri tidak boleh kosong.')

const profileSchema = z.object({
  fullName: z.string().max(120, 'Nama terlalu panjang — maksimal 120 karakter.'),
  headline: z.string().max(120, 'Profesi terlalu panjang — maksimal 120 karakter.'),
  email: z.union([z.literal(''), z.email({ error: 'Email belum benar. Contoh: nama@domain.com' })]),
  phone: z
    .string()
    .regex(/^(\+?\d[\d\s()-]{4,})?$/, 'Nomor telepon belum benar. Contoh: +62 812 3456 7890'),
  location: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  photoEnabled: z.literal(false),
})

const experienceSchema = z.object({
  id: idField(),
  role: z.string(),
  company: z.string(),
  location: z.string(),
  startDate: yearMonth(),
  endDate: yearMonth(),
  current: z.boolean(),
  bullets: z.array(z.string()),
  stack: z.array(z.string()),
})

const educationSchema = z.object({
  id: idField(),
  degree: z.string(),
  field: z.string(),
  institution: z.string(),
  location: z.string(),
  startDate: yearMonth(),
  endDate: yearMonth(),
  gpa: z.string().regex(/^([0-4](\.\d{1,2})?)?$/, 'IPK harus antara 0.00–4.00. Contoh: 3.71'),
  notes: z.array(z.string()),
})

const skillGroupSchema = z.object({
  id: idField(),
  name: z.string(),
  items: z.array(z.string()),
})

const projectSchema = z.object({
  id: idField(),
  name: z.string(),
  role: z.string(),
  url: z.string(),
  startDate: yearMonth(),
  endDate: yearMonth(),
  bullets: z.array(z.string()),
  stack: z.array(z.string()),
})

const certificationSchema = z.object({
  id: idField(),
  name: z.string(),
  issuer: z.string(),
  issuedAt: yearMonth(),
  credentialId: z.string(),
  url: z.string(),
})

const languageSchema = z.object({
  id: idField(),
  name: z.string(),
  proficiency: z.enum(['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic']),
})

const awardSchema = z.object({
  id: idField(),
  title: z.string(),
  issuer: z.string(),
  awardedAt: yearMonth(),
  description: z.string(),
})

const volunteeringSchema = z.object({
  id: idField(),
  role: z.string(),
  organization: z.string(),
  startDate: yearMonth(),
  endDate: yearMonth(),
  current: z.boolean(),
  bullets: z.array(z.string()),
})

const sectionSchemas = [
  z.object({
    id: idField(),
    kind: z.literal('profile'),
    visible: z.boolean(),
    data: profileSchema,
  }),
  z.object({
    id: idField(),
    kind: z.literal('summary'),
    visible: z.boolean(),
    data: z.object({ text: z.string() }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('experience'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(experienceSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('education'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(educationSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('skills'),
    visible: z.boolean(),
    data: z.object({ groups: z.array(skillGroupSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('projects'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(projectSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('certifications'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(certificationSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('languages'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(languageSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('awards'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(awardSchema) }),
  }),
  z.object({
    id: idField(),
    kind: z.literal('volunteering'),
    visible: z.boolean(),
    data: z.object({ entries: z.array(volunteeringSchema) }),
  }),
] as const

export const sectionSchema = z.discriminatedUnion('kind', sectionSchemas)

export const resumeDocSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200, 'Judul maksimal 200 karakter.'),
  templateId: z.enum(['classic-ats', 'ledger', 'executive', 'minimal', 'technician']),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  settings: z.object({
    page: z.object({
      size: z.enum(['A4', 'LETTER']),
      marginMm: z.number().min(5, 'Margin minimal 5 mm.').max(50, 'Margin maksimal 50 mm.'),
      showPageNumbers: z.boolean(),
    }),
    language: z.enum(['id', 'en']),
  }),
  theme: z.object({
    accentHex: z
      .union([
        z.literal(''),
        z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus hex 6 digit. Contoh: #0F5A78.'),
      ])
      .nullable(),
    fontScale: z.union([
      z.literal(0.9),
      z.literal(0.95),
      z.literal(1),
      z.literal(1.05),
      z.literal(1.1),
    ]),
  }),
  sections: z.array(sectionSchema).min(1, 'Dokumen harus punya minimal satu bagian.'),
  jobDescription: z.string().nullable(),
  meta: z.object({
    createdAt: z.number().positive(),
    updatedAt: z.number().positive(),
    lastCheckedAt: z.number().positive().nullable(),
  }),
})

export function parseResumeDoc(data: unknown): ResumeDoc {
  return resumeDocSchema.parse(data)
}

type RawDoc = Record<string, unknown>
type Migration = (doc: RawDoc) => RawDoc

const migrateV0toV1: Migration = (doc) => {
  const meta = (doc.meta ?? {}) as Record<string, unknown>
  const now = Date.now()
  const settings = (doc.settings ?? {}) as Record<string, unknown>
  const page = (settings.page ?? {}) as Record<string, unknown>
  const theme = (doc.theme ?? {}) as Record<string, unknown>

  return {
    ...doc,
    settings: {
      ...settings,
      page: {
        size: page.size ?? 'A4',
        marginMm: page.marginMm ?? 18,
        showPageNumbers: page.showPageNumbers ?? true,
      },
      language: settings.language ?? 'id',
    },
    theme: {
      accentHex: theme.accentHex ?? null,
      fontScale: theme.fontScale ?? 1,
    },
    jobDescription: doc.jobDescription ?? null,
    schemaVersion: 1,
    meta: {
      createdAt: typeof meta.createdAt === 'number' ? meta.createdAt : now,
      updatedAt: typeof meta.updatedAt === 'number' ? meta.updatedAt : now,
      lastCheckedAt: typeof meta.lastCheckedAt === 'number' ? meta.lastCheckedAt : null,
    },
  }
}

const migrations: Record<number, Migration> = {
  0: migrateV0toV1,
}

export function migrate(doc: unknown): ResumeDoc {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error('Dokumen bukan objek.')
  }
  let current = doc as RawDoc
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(`Dokumen berasal dari versi skema yang lebih baru (${version}).`)
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version]
    if (!step) throw new Error(`Tidak ada jalur migrasi dari versi ${version}.`)
    current = step(current)
    version = typeof current.schemaVersion === 'number' ? current.schemaVersion : version + 1
  }
  return parseResumeDoc(current)
}

export const SECTION_ORDER: readonly SectionKind[] = [
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
]

const newId = (): string => crypto.randomUUID()

export function createEmptyProfile(): ProfileData {
  return {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    photoEnabled: false,
  }
}

export function createEmptyEntry<K extends EntriesSectionKind>(kind: K): EntryOf<K> {
  const id = newId()
  switch (kind) {
    case 'experience':
      return {
        id,
        role: '',
        company: '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: [],
        stack: [],
      } as EntryOf<K>
    case 'education':
      return {
        id,
        degree: '',
        field: '',
        institution: '',
        location: '',
        startDate: '',
        endDate: '',
        gpa: '',
        notes: [],
      } as EntryOf<K>
    case 'projects':
      return {
        id,
        name: '',
        role: '',
        url: '',
        startDate: '',
        endDate: '',
        bullets: [],
        stack: [],
      } as EntryOf<K>
    case 'certifications':
      return {
        id,
        name: '',
        issuer: '',
        issuedAt: '',
        credentialId: '',
        url: '',
      } as EntryOf<K>
    case 'languages':
      return { id, name: '', proficiency: 'Intermediate' } as EntryOf<K>
    case 'awards':
      return { id, title: '', issuer: '', awardedAt: '', description: '' } as EntryOf<K>
    case 'volunteering':
      return {
        id,
        role: '',
        organization: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: [],
      } as EntryOf<K>
  }
}

export function createEmptySectionData<K extends SectionKind>(kind: K): SectionDataOf<K> {
  switch (kind) {
    case 'profile':
      return createEmptyProfile() as SectionDataOf<K>
    case 'summary':
      return { text: '' } as unknown as SectionDataOf<K>
    case 'skills':
      return { groups: [] } as unknown as SectionDataOf<K>
    case 'experience':
    case 'education':
    case 'projects':
    case 'certifications':
    case 'languages':
    case 'awards':
    case 'volunteering':
      return { entries: [] } as unknown as SectionDataOf<K>
  }
}

function section<K extends SectionKind>(kind: K, visible = true): SectionInstance {
  return {
    id: newId(),
    kind,
    visible,
    data: createEmptySectionData(kind),
  } as SectionInstance
}

export function createSampleDoc(): ResumeDoc {
  const now = Date.now()
  const experience: ExperienceEntry[] = [
    {
      id: newId(),
      role: 'Senior Software Engineer',
      company: 'Tech Nusantara Corp',
      location: 'Jakarta, Indonesia',
      startDate: '2022-04',
      endDate: '',
      current: true,
      bullets: [
        'Led migration of a monolithic checkout flow to microservices, cutting p95 latency from 1.8s to 420ms for 40k daily users.',
        'Designed PostgreSQL partitioning and index strategy for the orders table, reducing monthly storage growth by 35%.',
        'Mentored 4 junior engineers through structured code review rotations and weekly pairing sessions.',
      ],
      stack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Kubernetes'],
    },
    {
      id: newId(),
      role: 'Software Engineer',
      company: 'Kirana Digital',
      location: 'Bandung, Indonesia',
      startDate: '2019-08',
      endDate: '2022-03',
      current: false,
      bullets: [
        'Built an inventory reconciliation service processing 2M+ SKU updates nightly at 99.9% success rate.',
        'Introduced an automated regression suite that reduced release hotfixes by 45% over two quarters.',
        'Optimized SQL queries in the reporting module, shortening dashboard load time from 9s to 1.2s.',
      ],
      stack: ['Vue', 'PHP', 'MySQL', 'Redis'],
    },
  ]

  const education: EducationEntry[] = [
    {
      id: newId(),
      degree: 'B.Sc.',
      field: 'Computer Science',
      institution: 'Institut Teknologi Bandung',
      location: 'Bandung, Indonesia',
      startDate: '2015-08',
      endDate: '2019-06',
      gpa: '3.71',
      notes: [
        'Thesis: course recommender system using collaborative filtering on 5 years of enrollment data.',
      ],
    },
  ]

  const projects: ProjectEntry[] = [
    {
      id: newId(),
      name: 'Open Transit API',
      role: 'Maintainer',
      url: 'https://github.com/alexmorgan/transit-api',
      startDate: '2021-02',
      endDate: '',
      bullets: [
        'Community REST API serving 300k monthly requests for Jakarta bus and rail schedules.',
      ],
      stack: ['TypeScript', 'Fastify', 'PostgreSQL'],
    },
    {
      id: newId(),
      name: 'Resume Toolkit',
      role: 'Author',
      url: 'https://github.com/alexmorgan/resume-toolkit',
      startDate: '2020-05',
      endDate: '2021-01',
      bullets: [
        'Open-source PDF text extractor with layout order preserved, used by 1.2k GitHub users.',
      ],
      stack: ['Python', 'pdfminer'],
    },
  ]

  const certifications: CertificationEntry[] = [
    {
      id: newId(),
      name: 'AWS Certified Solutions Architect – Associate',
      issuer: 'Amazon Web Services',
      issuedAt: '2023-11',
      credentialId: 'AWS-SAA-87213',
      url: 'https://cp.amazonaws.com/badges',
    },
  ]

  const languages: LanguageEntry[] = [
    { id: newId(), name: 'Bahasa Indonesia', proficiency: 'Native' },
    { id: newId(), name: 'English', proficiency: 'Professional' },
  ]

  const awards: AwardEntry[] = []
  const volunteering: VolunteeringEntry[] = []

  return {
    id: newId(),
    title: 'CV Alex Morgan — Software Engineer',
    templateId: 'classic-ats',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { page: { size: 'A4', marginMm: 18, showPageNumbers: true }, language: 'id' },
    theme: { accentHex: null, fontScale: 1 },
    sections: [
      {
        id: newId(),
        kind: 'profile',
        visible: true,
        data: {
          fullName: 'Alex Morgan',
          headline: 'Software Engineer',
          email: 'alex.morgan@mail.com',
          phone: '+62 812 3456 7890',
          location: 'Jakarta, Indonesia',
          links: [
            { label: 'LinkedIn', url: 'https://linkedin.com/in/alexmorgan' },
            { label: 'GitHub', url: 'https://github.com/alexmorgan' },
          ],
          photoEnabled: false,
        },
      },
      {
        id: newId(),
        kind: 'summary',
        visible: true,
        data: {
          text: 'Software engineer with 6 years building high-traffic web services in fintech and marketplace environments. Comfortable across the stack with React, TypeScript, and Node.js, with a track record of cutting query latency and mentoring junior engineers. Looking to solve reliability problems at scale.',
        },
      },
      { id: newId(), kind: 'experience', visible: true, data: { entries: experience } },
      { id: newId(), kind: 'education', visible: true, data: { entries: education } },
      {
        id: newId(),
        kind: 'skills',
        visible: true,
        data: {
          groups: [
            {
              id: newId(),
              name: 'Languages & Frameworks',
              items: ['TypeScript', 'JavaScript', 'React', 'Node.js', 'SQL'],
            },
            {
              id: newId(),
              name: 'Infrastructure & Data',
              items: ['PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS'],
            },
            {
              id: newId(),
              name: 'Practices',
              items: ['Code review', 'CI/CD', 'Observability', 'Incident response'],
            },
          ],
        },
      },
      { id: newId(), kind: 'projects', visible: true, data: { entries: projects } },
      { id: newId(), kind: 'certifications', visible: true, data: { entries: certifications } },
      { id: newId(), kind: 'languages', visible: true, data: { entries: languages } },
      { id: newId(), kind: 'awards', visible: false, data: { entries: awards } },
      { id: newId(), kind: 'volunteering', visible: false, data: { entries: volunteering } },
    ],
    jobDescription: null,
    meta: { createdAt: now, updatedAt: now, lastCheckedAt: null },
  }
}

export function createEmptyDoc(): ResumeDoc {
  const now = Date.now()
  return {
    id: newId(),
    title: '',
    templateId: 'classic-ats',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: { page: { size: 'A4', marginMm: 18, showPageNumbers: true }, language: 'id' },
    theme: { accentHex: null, fontScale: 1 },
    sections: SECTION_ORDER.map((kind) => section(kind)),
    jobDescription: null,
    meta: { createdAt: now, updatedAt: now, lastCheckedAt: null },
  }
}
