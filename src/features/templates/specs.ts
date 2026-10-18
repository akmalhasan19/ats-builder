import type { TranslationKey } from '@/lib/i18n'
import type { PageSettings, TemplateId, ThemeTokens } from '@/types/resume'

/**
 * `TemplateSpec` (T6.1) — satu sumber nilai layout yang dibaca dua presentasi (P4):
 * renderer layar Fase 4 dan renderer PDF Fase 5. Satuan dpi-independen: mm untuk
 * ruang, pt untuk tipe. Tidak ada nilai layout yang boleh diulang di komponen.
 *
 * Nilai tipografi per template mengikuti tabel §2.3; peran `headline`/`contact`/`title`
 * tidak ada di tabel itu (tambahan mesin Fase 4), jadi mengikuti keluarga meta/body
 * masing-masing template.
 */

export type TemplateFontKey = 'archivo' | 'plexSans' | 'plexMono' | 'sourceSerif'

/** Family CSS untuk layar. PDF memakai pemetaan `PDF_FONT_FAMILY` di ResumePdfLib. */
export const TEMPLATE_FONTS: Record<TemplateFontKey, string> = {
  archivo: "'Archivo', 'IBM Plex Sans', sans-serif",
  plexSans: "'IBM Plex Sans', sans-serif",
  plexMono: "'IBM Plex Mono', monospace",
  sourceSerif: "'Source Serif 4', Georgia, serif",
}

/** Aksen opsional (T6.1) — satu-satunya hex aksen; setara token --cyanotype §2.2. */
export const ACCENT_HEX = '#0F5A78'

/** Label keluarga font untuk panel data spec (nama diri, bukan string UI). */
export const TEMPLATE_FONT_LABELS: Record<TemplateFontKey, string> = {
  archivo: 'Archivo',
  plexSans: 'IBM Plex Sans',
  plexMono: 'IBM Plex Mono',
  sourceSerif: 'Source Serif 4',
}

/**
 * Rasio sintesis small-caps (§2.3 executive): glyph kapital dari huruf kecil
 * digambar 0,8× ukuran heading — di layar oleh CSS `font-variant`, di PDF oleh
 * `drawSmallCaps`. CSS tidak mengekspos rasio sintesisnya, jadi angka ini adalah
 * acuan sisi PDF agar posisi baseline & lebar baris tetap dalam toleransi Gate.
 */
export const SMALL_CAPS_RATIO = 0.8

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
  italic?: boolean
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
  headingStyle: {
    transform: 'uppercase' | 'none' | 'small-caps'
    rule: HeadingRuleStyle
  }
  nameAlign: 'left' | 'center'
  contactStyle: { separator: string; align: 'left' | 'center' }
  entryLayout: { datePosition: 'right' | 'next-line' }
  bulletGlyph: string
  /** Aksen warna hanya untuk template yang mengizinkan (T6.1: ledger saja). */
  accentAllowed: boolean
  /** Hasil resolveSpec: null = hitam-putih murni (default paling ATS-safe). */
  accentHex: string | null
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
    titleToDate: number
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
  italic = false,
): TypeRole =>
  italic
    ? { font, sizePt, weight, lineHeight, trackingEm, italic }
    : { font, sizePt, weight, lineHeight, trackingEm }

/** Tinggi total rule heading dalam pt — PDF dan estimator pagination memakai angka sama. */
export const ruleAdvancePt = (rule: HeadingRuleStyle): number =>
  rule.kind === 'none' ? 0 : rule.kind === 'double' ? rule.widthPt * 3 : rule.widthPt

const classicAts: TemplateSpec = {
  id: 'classic-ats',
  nameId: 'template.classic-ats',
  descriptionId: 'template.desc.classic-ats',
  marginMm: 18,
  typeScale: {
    name: role('sourceSerif', 22, 700, 1.15),
    headline: role('plexSans', 11, 500, 1.35),
    contact: role('sourceSerif', 9.5, 400, 1.42),
    heading: role('sourceSerif', 10.5, 700, 1.42, 0.08),
    title: role('sourceSerif', 10.5, 700, 1.4),
    // §2.3: meta Classic = Source Serif Italic 9.5 pt.
    meta: role('sourceSerif', 9.5, 400, 1.42, 0, true),
    body: role('sourceSerif', 10, 400, 1.4),
  },
  headingStyle: { transform: 'uppercase', rule: { kind: 'solid', widthPt: 0.75, color: 'ink' } },
  nameAlign: 'left',
  contactStyle: { separator: ' · ', align: 'left' },
  // T6.2: tanggal kanan untuk classic-ats & executive.
  entryLayout: { datePosition: 'right' },
  bulletGlyph: '•',
  accentAllowed: false,
  accentHex: null,
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
    contactToSection: 6.5,
    sectionToSection: 6.5,
    entryToEntry: 3.5,
    headingToRule: 1.2,
    ruleToBody: 2.6,
    titleToMeta: 0.8,
    titleToDate: 3,
    metaToBody: 1.5,
    betweenBullets: 1.5,
    bulletIndent: 4.5,
  },
}

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
  // Rule ledger adalah satu-satunya slot aksen: default hitam (accentHex null),
  // cyanotype hanya saat pengguna menyalakan aksen (T6.1).
  headingStyle: { transform: 'uppercase', rule: { kind: 'solid', widthPt: 2, color: 'accent' } },
  nameAlign: 'left',
  contactStyle: { separator: ' · ', align: 'left' },
  entryLayout: { datePosition: 'next-line' },
  bulletGlyph: '•',
  accentAllowed: true,
  accentHex: null,
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
    titleToDate: 3,
    metaToBody: 1.4,
    betweenBullets: 1.4,
    bulletIndent: 4.5,
  },
}

const executive: TemplateSpec = {
  id: 'executive',
  nameId: 'template.executive',
  descriptionId: 'template.desc.executive',
  marginMm: 20,
  typeScale: {
    name: role('sourceSerif', 24, 700, 1.15),
    headline: role('plexSans', 11, 500, 1.35),
    contact: role('plexSans', 9.2, 400, 1.45),
    // §2.3: Plex Sans 600, small-caps, double rule 0.5 pt. Tracking tidak
    // disebut tabel → 0, agar sintesis small-caps tetap rapi.
    heading: role('plexSans', 10, 600, 1.45),
    title: role('plexSans', 10, 600, 1.45),
    meta: role('plexSans', 9.2, 400, 1.45),
    body: role('plexSans', 10, 400, 1.45),
  },
  headingStyle: { transform: 'small-caps', rule: { kind: 'double', widthPt: 0.5, color: 'ink' } },
  nameAlign: 'center',
  contactStyle: { separator: ' · ', align: 'center' },
  entryLayout: { datePosition: 'right' },
  bulletGlyph: '•',
  accentAllowed: false,
  accentHex: null,
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
    contactToSection: 7,
    sectionToSection: 7,
    entryToEntry: 4,
    headingToRule: 1.4,
    ruleToBody: 2.8,
    titleToMeta: 0.8,
    titleToDate: 3,
    metaToBody: 1.5,
    betweenBullets: 1.5,
    bulletIndent: 4.5,
  },
}

const minimal: TemplateSpec = {
  id: 'minimal',
  nameId: 'template.minimal',
  descriptionId: 'template.desc.minimal',
  marginMm: 15,
  typeScale: {
    // §2.3: Plex Sans 19 pt weight 300 +0.04em (font Light di-self-host Fase 6).
    name: role('plexSans', 19, 300, 1.2, 0.04),
    headline: role('plexSans', 10.5, 400, 1.4),
    contact: role('plexSans', 9, 400, 1.5),
    heading: role('plexSans', 9, 600, 1.5, 0.18),
    title: role('plexSans', 10, 500, 1.5),
    // §2.3: meta Minimal = Plex Sans 9 pt --ink-tertiary.
    meta: role('plexSans', 9, 400, 1.5),
    body: role('plexSans', 10, 400, 1.5),
  },
  headingStyle: { transform: 'uppercase', rule: { kind: 'none', widthPt: 0, color: 'ink' } },
  nameAlign: 'left',
  contactStyle: { separator: ' · ', align: 'left' },
  entryLayout: { datePosition: 'next-line' },
  bulletGlyph: '•',
  accentAllowed: false,
  accentHex: null,
  colors: {
    name: 'ink',
    headline: 'secondary',
    contact: 'secondary',
    heading: 'ink',
    rule: 'ink',
    entryTitle: 'ink',
    entryMeta: 'tertiary',
    body: 'ink',
  },
  gapMm: {
    nameToHeadline: 1.5,
    headlineToContact: 2,
    contactToSection: 7,
    sectionToSection: 7.5,
    entryToEntry: 4.5,
    headingToRule: 1,
    ruleToBody: 2.5,
    titleToMeta: 0.8,
    titleToDate: 3,
    metaToBody: 1.8,
    betweenBullets: 1.8,
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
  accentHex: null,
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
    titleToDate: 3,
    metaToBody: 1.2,
    betweenBullets: 1.2,
    bulletIndent: 4,
  },
}

const SPECS: Record<TemplateId, TemplateSpec> = {
  'classic-ats': classicAts,
  ledger,
  executive,
  minimal,
  technician,
}

export function getSpec(templateId: TemplateId): TemplateSpec {
  return SPECS[templateId] ?? ledger
}

const scaleRole = (role: TypeRole, factor: number): TypeRole => ({
  ...role,
  sizePt: role.sizePt * factor,
})

/**
 * Spec final untuk satu dokumen: margin override, fontScale, dan aksen sudah
 * diterapkan. `accentHex` null = semua slot 'accent' ditulis ulang jadi 'ink'
 * (T6.1: default hitam-putih, paling ATS-safe).
 */
export function resolveSpec(
  templateId: TemplateId,
  theme: Partial<Pick<ThemeTokens, 'fontScale' | 'accentHex'>>,
  page: Pick<PageSettings, 'marginMm'>,
): TemplateSpec {
  const spec = getSpec(templateId)
  const scale = theme.fontScale || 1
  const typeScale = Object.fromEntries(
    Object.entries(spec.typeScale).map(([key, value]) => [key, scaleRole(value, scale)]),
  ) as TemplateSpec['typeScale']
  const accentHex = spec.accentAllowed ? (theme.accentHex ?? null) : null
  const tint = (key: SpecColorKey): SpecColorKey =>
    accentHex === null && key === 'accent' ? 'ink' : key
  return {
    ...spec,
    marginMm: page.marginMm || spec.marginMm,
    typeScale,
    accentHex,
    headingStyle: {
      ...spec.headingStyle,
      rule: { ...spec.headingStyle.rule, color: tint(spec.headingStyle.rule.color) },
    },
    colors: Object.fromEntries(
      Object.entries(spec.colors).map(([slot, key]) => [slot, tint(key)]),
    ) as TemplateSpec['colors'],
  }
}

/**
 * Label heading yang digambar. `small-caps` tetap memakai teks asli: layar
 * mensintesis lewat CSS, PDF lewat `drawSmallCaps` yang membaca kapitalisasi
 * asli tiap karakter — menguppercase di sini justru mematikan small-caps.
 */
export const headingLabel = (text: string, spec: TemplateSpec): string =>
  spec.headingStyle.transform === 'uppercase' ? text.toUpperCase() : text

export const contactLine = (contact: (string | undefined)[], spec: TemplateSpec): string =>
  contact.filter((part): part is string => Boolean(part)).join(spec.contactStyle.separator)
