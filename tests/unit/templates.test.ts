import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACCENT_HEX,
  getSpec,
  headingLabel,
  resolveSpec,
  ruleAdvancePt,
  SMALL_CAPS_RATIO,
} from '@/features/templates/specs'
import { buildBlocks } from '@/features/preview/blocks'
import type { DocBlock } from '@/features/preview/pagination'
import { createSampleDoc } from '@/schema/resume'
import { useDocStore } from '@/store/docStore'
import { fontFileFor, type PdfFontFamily } from '@/features/pdf/fonts'
import { PDF_FONT_FAMILY } from '@/features/templates/pdf/ResumePdfLib'
import type { ResumeDoc, SectionInstance, TemplateId } from '@/types/resume'

const TEMPLATE_IDS: TemplateId[] = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']

const doc = createSampleDoc()

describe('T6.1 — lima spec mengikuti tabel §2.3', () => {
  it('kelima template punya spec nyata dengan margin §2.3', () => {
    const margins: Record<TemplateId, number> = {
      'classic-ats': 18,
      ledger: 16,
      executive: 20,
      minimal: 15,
      technician: 14,
    }
    for (const id of TEMPLATE_IDS) {
      expect(getSpec(id).marginMm, id).toBe(margins[id])
    }
  })

  it('heading rule §2.3: solid 0.75 / solid 2 / double 0.5 / none / dotted 0.75', () => {
    expect(getSpec('classic-ats').headingStyle.rule).toMatchObject({
      kind: 'solid',
      widthPt: 0.75,
    })
    expect(getSpec('ledger').headingStyle.rule).toMatchObject({ kind: 'solid', widthPt: 2 })
    expect(getSpec('executive').headingStyle.rule).toMatchObject({
      kind: 'double',
      widthPt: 0.5,
    })
    expect(getSpec('minimal').headingStyle.rule).toMatchObject({ kind: 'none' })
    expect(getSpec('technician').headingStyle.rule).toMatchObject({
      kind: 'dotted',
      widthPt: 0.75,
    })
  })

  it('keluarga font §2.3: Source Serif 4 untuk classic-ats & executive, Plex 300 untuk minimal', () => {
    expect(getSpec('classic-ats').typeScale.name.font).toBe('sourceSerif')
    expect(getSpec('classic-ats').typeScale.body.font).toBe('sourceSerif')
    expect(getSpec('classic-ats').typeScale.meta.italic).toBe(true)
    expect(getSpec('executive').typeScale.name.font).toBe('sourceSerif')
    expect(getSpec('executive').headingStyle.transform).toBe('small-caps')
    expect(getSpec('minimal').typeScale.name.weight).toBe(300)
    expect(getSpec('minimal').typeScale.name.trackingEm).toBeCloseTo(0.04)
  })

  it('setiap role tipografi punya TTF PDF terdaftar (fontFileFor tidak melempar)', () => {
    for (const id of TEMPLATE_IDS) {
      const spec = resolveSpec(id, doc.theme, doc.settings.page)
      for (const role of Object.values(spec.typeScale)) {
        expect(() =>
          fontFileFor(
            PDF_FONT_FAMILY[role.font] as PdfFontFamily,
            role.weight,
            role.italic ? 'italic' : 'normal',
          ),
        ).not.toThrow()
      }
    }
  })
})

describe('T6.1 — aksen (accentHex)', () => {
  it('default hitam-putih: accentHex null dan slot accent ditulis ulang jadi ink', () => {
    const resolved = resolveSpec('ledger', doc.theme, doc.settings.page)
    expect(resolved.accentHex).toBeNull()
    expect(resolved.headingStyle.rule.color).toBe('ink')
  })

  it('aksen hanya untuk ledger; template lain mengabaikan theme.accentHex', () => {
    for (const id of TEMPLATE_IDS) {
      const resolved = resolveSpec(id, { accentHex: ACCENT_HEX }, doc.settings.page)
      if (id === 'ledger') {
        expect(resolved.accentHex).toBe(ACCENT_HEX)
        expect(resolved.headingStyle.rule.color).toBe('accent')
      } else {
        expect(resolved.accentHex, id).toBeNull()
        expect(getSpec(id).accentAllowed).toBe(false)
      }
    }
  })

  it('ruleAdvancePt double = 3× lebar (footprint rule() PDF)', () => {
    expect(ruleAdvancePt({ kind: 'double', widthPt: 0.5, color: 'ink' })).toBeCloseTo(1.5)
    expect(ruleAdvancePt({ kind: 'solid', widthPt: 2, color: 'ink' })).toBeCloseTo(2)
    expect(ruleAdvancePt({ kind: 'none', widthPt: 0, color: 'ink' })).toBe(0)
  })

  it('small-caps tetap memakai teks asli (sintesis di renderer), uppercase menge uppercase', () => {
    expect(headingLabel('Pengalaman', getSpec('executive'))).toBe('Pengalaman')
    expect(headingLabel('Pengalaman', getSpec('classic-ats'))).toBe('PENGALAMAN')
    expect(SMALL_CAPS_RATIO).toBeGreaterThan(0.5)
  })
})

describe('T6.2 — layout entri', () => {
  it('tanggal kanan untuk classic-ats/executive, baris berikut untuk minimal/technician', () => {
    expect(getSpec('classic-ats').entryLayout.datePosition).toBe('right')
    expect(getSpec('executive').entryLayout.datePosition).toBe('right')
    expect(getSpec('minimal').entryLayout.datePosition).toBe('next-line')
    expect(getSpec('technician').entryLayout.datePosition).toBe('next-line')
    expect(getSpec('ledger').entryLayout.datePosition).toBe('next-line')
  })

  it('kontak selalu satu baris dipisah " · " (aturan ATS §2.3)', () => {
    for (const id of TEMPLATE_IDS) {
      expect(getSpec(id).contactStyle.separator, id).toBe(' · ')
    }
  })
})

describe('T6.5 — guardrail ATS di level template', () => {
  // Slot teks; `rule` adalah garis dekoratif, bukan teks.
  const TEXT_SLOTS = [
    'name',
    'headline',
    'contact',
    'heading',
    'entryTitle',
    'entryMeta',
    'body',
  ] as const

  const css = readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
  const hexTokens = new Map<string, string>()
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = match
    if (name && value) hexTokens.set(name, value.toLowerCase())
  }
  const hexFor = (name: string): string => {
    const value = hexTokens.get(name)
    if (!value) throw new Error(`Token --color-${name} tidak ditemukan`)
    return value
  }
  const luminance = (hex: string): number => {
    const clean = hex.replace('#', '')
    const channel = (index: number) => {
      const normalized = Number.parseInt(clean.slice(index, index + 2), 16) / 255
      return normalized <= 0.04045
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
  }
  const contrastOnPaper = (token: string): number => {
    const la = luminance(hexFor(token))
    const lb = luminance(hexFor('raised'))
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  it('tidak ada slot teks dengan kontras < 4.5:1 di atas kertas', () => {
    const varToToken: Record<string, string> = {
      ink: 'ink',
      secondary: 'ink-secondary',
      tertiary: 'ink-tertiary',
      accent: 'document-accent',
    }
    for (const id of TEMPLATE_IDS) {
      const spec = getSpec(id)
      for (const slot of TEXT_SLOTS) {
        const key = spec.colors[slot]
        const token = varToToken[key]
        if (!token) throw new Error(`Slot ${id}.${slot} memakai kunci warna tak dikenal: ${key}`)
        expect(contrastOnPaper(token), `${id}.${slot} (${token})`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('tiap template menghasilkan urutan blok yang sama untuk dokumen yang sama', () => {
    const skeleton = (blocks: DocBlock[]): string =>
      JSON.stringify(
        blocks.map(({ key, kind, sectionId, itemId, lineIndex, minWithNext }) => ({
          key,
          kind,
          sectionId,
          itemId,
          lineIndex,
          minWithNext,
        })),
      )
    let reference: string | null = null
    for (const id of TEMPLATE_IDS) {
      const current = skeleton(buildBlocks(doc, getSpec(id)))
      if (reference === null) {
        reference = current
        continue
      }
      expect(current, id).toBe(reference)
    }
    expect(reference).not.toBeNull()
  })
})

describe('Gate Fase 6 — ganti template tidak mengubah data', () => {
  it('setTemplate hanya mengubah templateId; sections/settings/theme identik', () => {
    const store = useDocStore.getState()
    store.resetDoc(createSampleDoc())
    const before = useDocStore.getState().doc
    const snapshot = {
      sections: JSON.stringify(before.sections),
      settings: JSON.stringify(before.settings),
      theme: JSON.stringify(before.theme),
      title: before.title,
      jobDescription: before.jobDescription,
    }
    for (const id of TEMPLATE_IDS) {
      useDocStore.getState().setTemplate(id)
      const after = useDocStore.getState().doc
      expect(after.templateId).toBe(id)
      expect(JSON.stringify(after.sections)).toBe(snapshot.sections)
      expect(JSON.stringify(after.settings)).toBe(snapshot.settings)
      expect(JSON.stringify(after.theme)).toBe(snapshot.theme)
      expect(after.title).toBe(snapshot.title)
      expect(after.jobDescription).toBe(snapshot.jobDescription)
    }
  })

  it('semua kind section tetap ter-render di kelima template (tidak ada data hilang)', () => {
    const kinds = (sections: SectionInstance[]): string[] => sections.map((s) => s.kind)
    for (const id of TEMPLATE_IDS) {
      const probe: ResumeDoc = { ...doc, templateId: id }
      const blocks = buildBlocks(probe, getSpec(id))
      for (const section of doc.sections) {
        if (!section.visible) continue
        expect(
          blocks.some((block) => block.sectionId === section.id),
          `${id}: bagian ${section.kind}`,
        ).toBe(true)
      }
      expect(kinds(doc.sections).length).toBeGreaterThan(0)
    }
  })
})
