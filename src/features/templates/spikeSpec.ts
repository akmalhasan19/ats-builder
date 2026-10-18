/**
 * Spec tunggal untuk spike Fase 0 (P4: satu sumber layout, dua presentasi).
 * Renderer layar (`screen/SpikeSheet`) dan renderer PDF (`pdf/SpikePdfLib`)
 * membaca objek ini — tidak boleh ada nilai layout yang diduplikasi.
 *
 * Satuan sengaja dpi-independen: mm untuk ruang, pt untuk tipe.
 * Fase 6 (T6.1) menggantikan file ini dengan `specs.ts` + `TemplateSpec` penuh.
 */

export type SpikeFontKey = 'archivo' | 'plexSans' | 'plexMono'

/** Satu pasangan nama untuk dua dunia: family PDF (Font.register) dan family CSS. */
export const SPIKE_FONTS: Record<SpikeFontKey, { pdf: string; css: string }> = {
  archivo: { pdf: 'archivo', css: "'Archivo', 'IBM Plex Sans', sans-serif" },
  plexSans: { pdf: 'plex-sans', css: "'IBM Plex Sans', sans-serif" },
  plexMono: { pdf: 'plex-mono', css: "'IBM Plex Mono', monospace" },
}

export type SpikeSpec = {
  id: string
  marginMm: number
  colors: { ink: string; secondary: string; tertiary: string; rule: string }
  fonts: { name: SpikeFontKey; heading: SpikeFontKey; body: SpikeFontKey; meta: SpikeFontKey }
  type: {
    namePt: number
    nameWeight: number
    headlinePt: number
    headlineWeight: number
    contactPt: number
    headingPt: number
    headingWeight: number
    headingTrackingEm: number
    headingRulePt: number
    bodyPt: number
    bodyWeight: number
    titleWeight: number
    metaPt: number
  }
  lineHeight: { name: number; headline: number; body: number }
  gapMm: {
    nameToHeadline: number
    headlineToContact: number
    contactToFirstSection: number
    headingToRule: number
    ruleToBody: number
    titleToMeta: number
    metaToBullets: number
    betweenBullets: number
    betweenSections: number
  }
  bulletGlyph: string
  bulletIndentMm: number
  contactSeparator: string
  headingTransform: 'uppercase' | 'none'
}

export const spikeSpec: SpikeSpec = {
  id: 'spike-a4',
  marginMm: 16,
  colors: {
    ink: '#10161F',
    secondary: '#46505E',
    tertiary: '#78838F',
    rule: '#D3D9E0',
  },
  fonts: { name: 'archivo', heading: 'archivo', body: 'plexSans', meta: 'plexMono' },
  type: {
    // 600 (bukan 700 seperti Ledger §2.3) karena layar hanya self-host Archivo 600;
    // memakai bobot yang sama di dua renderer lebih penting daripada angka §2.3 di spike ini.
    namePt: 24,
    nameWeight: 600,
    headlinePt: 11,
    headlineWeight: 500,
    contactPt: 9.5,
    headingPt: 9.5,
    headingWeight: 600,
    headingTrackingEm: 0.14,
    headingRulePt: 2,
    bodyPt: 10,
    bodyWeight: 400,
    titleWeight: 600,
    metaPt: 8.8,
  },
  lineHeight: { name: 1.15, headline: 1.35, body: 1.42 },
  gapMm: {
    nameToHeadline: 1.5,
    headlineToContact: 2,
    contactToFirstSection: 6,
    headingToRule: 1.2,
    ruleToBody: 2.4,
    titleToMeta: 0.8,
    metaToBullets: 1.4,
    betweenBullets: 1.4,
    betweenSections: 6,
  },
  bulletGlyph: '•',
  bulletIndentMm: 4.5,
  contactSeparator: ' · ',
  headingTransform: 'uppercase',
}

/** Kontak satu baris dipisah ' · ' — bukan posisi absolut (§2.3 aturan ATS). */
export const formatContactLine = (contact: string[], spec: SpikeSpec = spikeSpec): string =>
  contact.filter(Boolean).join(spec.contactSeparator)

/** Heading di-uppercase di data, bukan lewat CSS/textTransform, supaya teks yang
 *  disalin dari PDF identik dengan yang tampil di layar. */
export const headingLabel = (text: string, spec: SpikeSpec = spikeSpec): string =>
  spec.headingTransform === 'uppercase' ? text.toUpperCase() : text
