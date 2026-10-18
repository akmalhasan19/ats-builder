import type { TranslationKey } from '@/lib/i18n'
import type { PageSettings, TemplateId, ThemeTokens } from '@/types/resume'

/**
 * `TemplateSpec` (T6.1) — satu sumber nilai layout yang dibaca dua presentasi (P4):
 * renderer layar Fase 4 dan renderer PDF Fase 5. Satuan dpi-independen: mm untuk
 * ruang, pt untuk tipe. Tidak ada nilai layout yang boleh diulang di komponen.
 */

export type TemplateFontKey = 'archivo' | 'plexSans' | 'plexMono'

/** Family CSS untuk layar. Fase 5 memakai pemetaan `pdf` di `SpikePdfLib`. */
export const TEMPLATE_FONTS: Record<TemplateFontKey, string> = {
  archivo: "'Archivo', 'IBM Plex Sans', sans-serif",
  plexSans: "'IBM Plex Sans', sans-serif",
  plexMono: "'IBM Plex Mono', monospace",
}

export type SpecColorKey = 'ink' | 'secondary' | 'tertiary' | 'rule' | 'accent' | 'paper'

/** Kunci warna semantik → token §2.2. Renderer layar tidak boleh menulis hex. */
export const SPEC_COLOR_VAR: Record<SpecColorKey, string> = {
  ink: 'var(--color-ink)',
  secondary: 'var(--color-ink-secondary)',
  tertiary: 'var(--color-ink-tertiary)',
  rule: 'var(--color-rule)',
  accent: 'var(--color-cyanotype)',
  paper: 'var(--color-raised)',
}

export type SpecColorSlot =
  'name' | 'headline' | 'contact' | 'heading' | 'rule' | 'entryTitle' | 'entryMeta' | 'body'

export type HeadingRuleStyle = {
  kind: 'none' | 'solid' | 'double' | 'dotted'
  widthPt: number
  color: SpecColorKey
}

export type TypeRole = {
  font: TemplateFontKey
  sizePt: number
  weight: number
  lineHeight: number
  trackingEm: number
}

export type TemplateSpec = {
  id: TemplateId
  nameId: TranslationKey
  descriptionId: TranslationKey
  marginMm: number
  typeScale: {
    name: TypeRole
    headline: TypeRole
    contact: TypeRole
    heading: TypeRole
    title: TypeRole
    meta: TypeRole
    body: TypeRole
  }
  headingStyle: { transform: 'uppercase' | 'none'; rule: HeadingRuleStyle }
  nameAlign: 'left' | 'center'
  contactStyle: { separator: string; align: 'left' | 'center' }
  entryLayout: { datePosition: 'right' | 'next-line' }
  bulletGlyph: string
  accentAllowed: boolean
  colors: Record<SpecColorSlot, SpecColorKey>
  gapMm: {
    nameToHeadline: number
    headlineToContact: number
    contactToSection: number
    sectionToSection: number
    entryToEntry: number
    headingToRule: number
    ruleToBody: number
    titleToMeta: number
    metaToBody: number
    betweenBullets: number
    bulletIndent: number
  }
}

const role = (
  font: TemplateFontKey,
  sizePt: number,
  weight: number,
  lineHeight: number,
  trackingEm = 0,
): TypeRole => ({ font, sizePt, weight, lineHeight, trackingEm })

const ledger: TemplateSpec = {
  id: 'ledger',
  nameId: 'template.ledger',
  descriptionId: 'template.desc.ledger',
  // Nilai ini sudah diverifikasi Fase 0 (`pdf:verify` Δ 0,00 mm) lewat `spikeSpec`.
  marginMm: 16,
  typeScale: {
    // §2.3 menulis Archivo 700 untuk nama; layar hanya meng-self-host Archivo 600,
    // jadi bobot 600 dipakai di dua renderer — konsisten > angka §2.3 di sini.
    name: role('archivo', 24, 600, 1.15),
    headline: role('plexSans', 11, 500, 1.35),
    contact: role('plexSans', 9.5, 400, 1.42),
    heading: role('archivo', 9.5, 600, 1.42, 0.14),
    title: role('plexSans', 10, 600, 1.42),
    meta: role('plexMono', 8.8, 400, 1.42),
    body: role('plexSans', 10, 400, 1.42),
  },
  headingStyle: { transform: 'uppercase', rule: { kind: 'solid', widthPt: 2, color: 'ink' } },
  nameAlign: 'left',
  contactStyle: { separator: ' · ', align: 'left' },
  entryLayout: { datePosition: 'next-line' },
  bulletGlyph: '•',
  accentAllowed: true,
  colors: {
    name: 'ink',
    headline: 'secondary',
    contact: 'secondary',
    heading: 'ink',
    rule: 'ink',
    entryTitle: 'ink',
    entryMeta: 'secondary',
    body: 'secondary',
  },
  gapMm: {
    nameToHeadline: 1.5,
    headlineToContact: 2,
    contactToSection: 6,
    sectionToSection: 6,
    entryToEntry: 3.5,
    headingToRule: 1.2,
    ruleToBody: 2.4,
    titleToMeta: 0.8,
    metaToBody: 1.4,
    betweenBullets: 1.4,
    bulletIndent: 4.5,
  },
}

const technician: TemplateSpec = {
  ...ledger,
  id: 'technician',
  nameId: 'template.technician',
  descriptionId: 'template.desc.technician',
  marginMm: 14,
  typeScale: {
    name: role('plexMono', 18, 600, 1.15, 0.02),
    headline: role('plexSans', 10.5, 500, 1.3),
    contact: role('plexSans', 9, 400, 1.4),
    heading: role('plexMono', 9, 600, 1.4, 0.1),
    title: role('plexSans', 9.8, 600, 1.4),
    meta: role('plexMono', 8.8, 400, 1.4),
    body: role('plexSans', 9.8, 400, 1.4),
  },
  headingStyle: { transform: 'uppercase', rule: { kind: 'dotted', widthPt: 0.75, color: 'rule' } },
  entryLayout: { datePosition: 'next-line' },
  accentAllowed: false,
  colors: { ...ledger.colors, entryMeta: 'tertiary', body: 'ink' },
  gapMm: {
    nameToHeadline: 1.2,
    headlineToContact: 1.6,
    contactToSection: 5,
    sectionToSection: 5,
    entryToEntry: 3,
    headingToRule: 1,
    ruleToBody: 2,
    titleToMeta: 0.7,
    metaToBody: 1.2,
    betweenBullets: 1.2,
    bulletIndent: 4,
  },
}

const base = ledger

const SPECS: Record<TemplateId, TemplateSpec> = {
  // classic-ats / executive / minimal memakai nilai ledger sampai T6.1 menuliskan
  // spec nyatanya (keputusan owner: Fase 4 membangun mesin, bukan koleksi tipografi).
  'classic-ats': {
    ...base,
    id: 'classic-ats',
    nameId: 'template.classic-ats',
    descriptionId: 'template.desc.classic-ats',
  },
  ledger,
  executive: {
    ...base,
    id: 'executive',
    nameId: 'template.executive',
    descriptionId: 'template.desc.executive',
  },
  minimal: {
    ...base,
    id: 'minimal',
    nameId: 'template.minimal',
    descriptionId: 'template.desc.minimal',
  },
  technician,
}

export function getSpec(templateId: TemplateId): TemplateSpec {
  return SPECS[templateId] ?? base
}

const scaleRole = (role: TypeRole, factor: number): TypeRole => ({
  ...role,
  sizePt: role.sizePt * factor,
})

/** Spec final untuk satu dokumen: margin override + fontScale_theme sudah diterapkan. */
export function resolveSpec(
  templateId: TemplateId,
  theme: Pick<ThemeTokens, 'fontScale'>,
  page: Pick<PageSettings, 'marginMm'>,
): TemplateSpec {
  const spec = getSpec(templateId)
  const scale = theme.fontScale || 1
  const typeScale = Object.fromEntries(
    Object.entries(spec.typeScale).map(([key, value]) => [key, scaleRole(value, scale)]),
  ) as TemplateSpec['typeScale']
  return {
    ...spec,
    marginMm: page.marginMm || spec.marginMm,
    typeScale,
  }
}

export const headingLabel = (text: string, spec: TemplateSpec): string =>
  spec.headingStyle.transform === 'uppercase' ? text.toUpperCase() : text

export const contactLine = (contact: (string | undefined)[], spec: TemplateSpec): string =>
  contact.filter((part): part is string => Boolean(part)).join(spec.contactStyle.separator)
