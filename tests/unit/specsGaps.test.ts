import { describe, expect, it } from 'vitest'
import {
  ACCENT_HEX,
  SPEC_COLOR_VAR,
  TEMPLATE_FONTS,
  contactLine,
  getSpec,
  headingLabel,
  resolveSpec,
  ruleAdvancePt,
  type TemplateSpec,
  type TypeRole,
} from '@/features/templates/specs'
import { createSampleDoc } from '@/schema/resume'
import type { PageSettings, TemplateId, ThemeTokens } from '@/types/resume'

/**
 * T9.1 — penutup cabang `src/features/templates/specs.ts` (baris 376 fallback
 * `getSpec`, baris 404 `marginMm ||`) dan kontrak `resolveSpec`: fontScale,
 * override margin, aksen warna, dan immutability spec dasar.
 */

const TEMPLATE_IDS: TemplateId[] = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']

const ROLE_KEYS = ['name', 'headline', 'contact', 'heading', 'title', 'meta', 'body'] as const

const COLOR_SLOTS = [
  'name',
  'headline',
  'contact',
  'heading',
  'rule',
  'entryTitle',
  'entryMeta',
  'body',
] as const

const page = (marginMm: number, size: PageSettings['size'] = 'A4'): PageSettings => ({
  size,
  marginMm,
  showPageNumbers: true,
})

describe('getSpec — lima template + fallback', () => {
  it('setiap id mengembalikan spec dengan id dan margin §2.3 sendiri', () => {
    const margins: Record<TemplateId, number> = {
      'classic-ats': 18,
      ledger: 16,
      executive: 20,
      minimal: 15,
      technician: 14,
    }
    for (const id of TEMPLATE_IDS) {
      const spec = getSpec(id)
      expect(spec.id).toBe(id)
      expect(spec.marginMm).toBe(margins[id])
      expect(spec.nameId).toBe(`template.${id}`)
      expect(spec.descriptionId).toBe(`template.desc.${id}`)
      expect(Object.keys(spec.typeScale)).toEqual([...ROLE_KEYS])
      expect(Object.keys(spec.colors)).toEqual([...COLOR_SLOTS])
    }
  })

  it('spec yang diminta dua kali mengembalikan objek yang sama (satu sumber nilai)', () => {
    expect(getSpec('ledger')).toBe(getSpec('ledger'))
    expect(getSpec('executive')).not.toBe(getSpec('ledger'))
  })

  it('id tidak dikenal jatuh ke ledger, bukan melempar (baris 376)', () => {
    const unknown = getSpec('tidak-ada' as TemplateId)
    expect(unknown).toBe(getSpec('ledger'))
    expect(unknown.id).toBe('ledger')
    expect(getSpec('' as TemplateId)).toBe(getSpec('ledger'))
    // undefined juga lewat cabang yang sama.
    expect(getSpec(undefined as unknown as TemplateId)).toBe(getSpec('ledger'))
  })

  it('hanya ledger yang mengizinkan aksen warna (T6.1)', () => {
    expect(TEMPLATE_IDS.map((id) => [id, getSpec(id).accentAllowed])).toEqual([
      ['classic-ats', false],
      ['ledger', true],
      ['executive', false],
      ['minimal', false],
      ['technician', false],
    ])
    for (const id of TEMPLATE_IDS) expect(getSpec(id).accentHex).toBeNull()
    expect(ACCENT_HEX).toBe('#0F5A78')
  })
})

describe('resolveSpec — fontScale (T9.1)', () => {
  const scales = [0.9, 0.95, 1, 1.05, 1.1] as const

  it('menaikkan/menurunkan sizePt setiap peran tipografi, kunci lain utuh', () => {
    for (const id of TEMPLATE_IDS) {
      const base = getSpec(id)
      for (const scale of scales) {
        const resolved = resolveSpec(id, { fontScale: scale }, page(base.marginMm))
        expect(Object.keys(resolved.typeScale), `${id}@${scale}`).toEqual([...ROLE_KEYS])
        for (const roleKey of ROLE_KEYS) {
          const original = base.typeScale[roleKey] as TypeRole
          const scaled = resolved.typeScale[roleKey] as TypeRole
          expect(scaled.sizePt, `${id}.${roleKey}@${scale}`).toBeCloseTo(
            original.sizePt * scale,
            10,
          )
          expect(scaled.font).toBe(original.font)
          expect(scaled.weight).toBe(original.weight)
          expect(scaled.lineHeight).toBe(original.lineHeight)
          expect(scaled.trackingEm).toBe(original.trackingEm)
          expect(scaled.italic).toBe(original.italic)
          expect(TEMPLATE_FONTS[scaled.font]).toContain("'")
        }
      }
    }
    // Skala 1.1 benar-benar lebih besar dari 0.9 untuk peran nama.
    const small = resolveSpec('ledger', { fontScale: 0.9 }, page(16)).typeScale.name.sizePt
    const large = resolveSpec('ledger', { fontScale: 1.1 }, page(16)).typeScale.name.sizePt
    expect(large).toBeGreaterThan(small)
  })

  it('fontScale hilang atau 0 diperlakukan sebagai 1 (temuan: 0 juga jatuh ke default)', () => {
    const base = getSpec('ledger')
    expect(resolveSpec('ledger', {}, page(16)).typeScale).toEqual(base.typeScale)
    expect(resolveSpec('ledger', { fontScale: undefined }, page(16)).typeScale).toEqual(
      base.typeScale,
    )
    // `theme.fontScale || 1` memakai 0 sebagai falsy -> 1, bukan 0.
    expect(resolveSpec('ledger', { fontScale: 0 }, page(16)).typeScale).toEqual(base.typeScale)
    expect(resolveSpec('ledger', { fontScale: 1 }, page(16)).typeScale).toEqual(base.typeScale)
  })
})

describe('resolveSpec — marginMm (baris 404)', () => {
  it('override margin dipakai apa adanya untuk semua template', () => {
    for (const id of TEMPLATE_IDS) {
      const base = getSpec(id)
      for (const margin of [5, 12, 25, 50]) {
        expect(resolveSpec(id, { fontScale: 1 }, page(margin)).marginMm).toBe(margin)
      }
      // spec dasar tidak ikut berubah oleh override.
      expect(getSpec(id).marginMm).toBe(base.marginMm)
    }
  })

  it('marginMm 0 jatuh balik ke margin spec, bukan 0 (guard || )', () => {
    expect(resolveSpec('ledger', { fontScale: 1 }, page(0)).marginMm).toBe(16)
    expect(resolveSpec('executive', { fontScale: 1 }, page(0)).marginMm).toBe(20)
    expect(resolveSpec('ledger', { fontScale: 1 }, { marginMm: NaN }).marginMm).toBe(16)
  })

  it('LETTER dan A4 menghasilkan spec yang sama: ukuran kertas bukan bagian resolveSpec', () => {
    const theme: ThemeTokens = { accentHex: null, fontScale: 1.05 }
    const a4 = resolveSpec('ledger', theme, page(18, 'A4'))
    const letter = resolveSpec('ledger', theme, page(18, 'LETTER'))
    expect(letter).toEqual(a4)
    expect(a4.marginMm).toBe(18)
  })
})

describe('resolveSpec — aksen warna (slot heading ikut berganti)', () => {
  it('ledger dengan accentHex mengisi slot accent', () => {
    const resolved = resolveSpec('ledger', { accentHex: ACCENT_HEX }, page(16))
    expect(resolved.accentHex).toBe(ACCENT_HEX)
    expect(resolved.headingStyle.rule.color).toBe('accent')
    expect(SPEC_COLOR_VAR[resolved.headingStyle.rule.color]).toBe('var(--color-cyanotype)')
    expect(resolved.headingStyle.transform).toBe('uppercase')
    expect(resolved.colors.heading).toBe('ink')
  })

  it('ledger tanpa accentHex meninta slot accent menjadi ink (default ATS-safe)', () => {
    for (const accent of [null, undefined]) {
      const resolved = resolveSpec('ledger', { accentHex: accent }, page(16))
      expect(resolved.accentHex).toBeNull()
      expect(resolved.headingStyle.rule.color).toBe('ink')
      expect(SPEC_COLOR_VAR[resolved.headingStyle.rule.color]).toBe('var(--color-ink)')
      for (const slot of COLOR_SLOTS) {
        expect(resolved.colors[slot], slot).not.toBe('accent')
      }
    }
  })

  it('template tanpa izin aksen selalu hitam-putih walau accentHex diisi', () => {
    for (const id of TEMPLATE_IDS.filter((templateId) => !getSpec(templateId).accentAllowed)) {
      const resolved = resolveSpec(id, { accentHex: '#F2D600' }, page(20))
      expect(resolved.accentHex, id).toBeNull()
      expect(resolved.headingStyle.rule.color, id).not.toBe('accent')
    }
    // technician memakai warna rule (bukan ink): slot non-accent tidak ditinta.
    expect(resolveSpec('technician', { accentHex: null }, page(14)).headingStyle.rule.color).toBe(
      'rule',
    )
    expect(getSpec('technician').colors.entryMeta).toBe('tertiary')
    expect(resolveSpec('technician', { accentHex: null }, page(14)).colors.entryMeta).toBe(
      'tertiary',
    )
    expect(resolveSpec('minimal', { accentHex: null }, page(15)).colors.body).toBe('ink')
  })

  it('fontScale dan accentHex diterapkan serentak lewat dokumen nyata', () => {
    const doc = createSampleDoc()
    doc.theme = { accentHex: ACCENT_HEX, fontScale: 1.1 }
    doc.settings.page = { size: 'LETTER', marginMm: 20, showPageNumbers: false }

    const resolved = resolveSpec(doc.templateId, doc.theme, doc.settings.page)
    expect(resolved.id).toBe('classic-ats')
    expect(resolved.accentHex).toBeNull() // classic-ats tidak mengizinkan aksen
    expect(resolved.marginMm).toBe(20)
    expect(resolved.typeScale.body.sizePt).toBeCloseTo(
      getSpec('classic-ats').typeScale.body.sizePt * 1.1,
      10,
    )
  })
})

describe('resolveSpec — immutability spec dasar', () => {
  const snapshotOf = (spec: TemplateSpec): TemplateSpec => structuredClone(spec)

  it('objek spec asal tidak diubah oleh resolveSpec', () => {
    for (const id of TEMPLATE_IDS) {
      const base = getSpec(id)
      const snapshot = snapshotOf(base)

      const resolved = resolveSpec(id, { fontScale: 1.1, accentHex: ACCENT_HEX }, page(30))

      expect(base, id).toEqual(snapshot)
      expect(getSpec(id)).toBe(base)
      expect(resolved).not.toBe(base)
      expect(resolved.typeScale).not.toBe(base.typeScale)
      expect(resolved.colors).not.toBe(base.colors)
      expect(resolved.headingStyle).not.toBe(base.headingStyle)
      expect(resolved.headingStyle.rule).not.toBe(base.headingStyle.rule)
      expect(resolved.typeScale.name).not.toBe(base.typeScale.name)
      expect(resolved.marginMm).toBe(30)
      expect(base.marginMm).toBe(snapshot.marginMm)

      // Dipanggil dua kali hasilnya identik: tidak ada state tersembunyi.
      expect(resolveSpec(id, { fontScale: 1.1, accentHex: ACCENT_HEX }, page(30))).toEqual(resolved)
    }
  })

  it('gapMm disalin utuh dan tidak terpengaruh skala', () => {
    const base = getSpec('ledger')
    const resolved = resolveSpec('ledger', { fontScale: 0.9 }, page(24))
    expect(resolved.gapMm).toEqual(base.gapMm)
    // Spread `{ ...spec }` menyalin referensi: `gapMm` dipakai bersama dan
    // karenanya tidak pernah boleh ditulis renderer.
    expect(resolved.gapMm).toBe(base.gapMm)
    expect(resolved.entryLayout).toBe(base.entryLayout)
    expect(resolved.bulletGlyph).toBe(base.bulletGlyph)
    expect(resolved.nameAlign).toBe(base.nameAlign)
  })
})

describe('helper specs lain', () => {
  it('ruleAdvancePt: none 0, solid = width, double = 3x width', () => {
    expect(ruleAdvancePt(getSpec('minimal').headingStyle.rule)).toBe(0)
    expect(ruleAdvancePt(getSpec('classic-ats').headingStyle.rule)).toBe(0.75)
    expect(ruleAdvancePt(getSpec('ledger').headingStyle.rule)).toBe(2)
    expect(ruleAdvancePt(getSpec('executive').headingStyle.rule)).toBe(1.5)
    expect(ruleAdvancePt(getSpec('technician').headingStyle.rule)).toBe(0.75)
    expect(ruleAdvancePt({ kind: 'double', widthPt: 1, color: 'ink' })).toBe(3)
  })

  it('headingLabel hanya menguppercase-kan template transform uppercase', () => {
    expect(headingLabel('Pengalaman', getSpec('ledger'))).toBe('PENGALAMAN')
    expect(headingLabel('Pengalaman', getSpec('minimal'))).toBe('PENGALAMAN')
    expect(headingLabel('Pengalaman', getSpec('technician'))).toBe('PENGALAMAN')
    // executive memakai small-caps: teks asli harus tetap utuh.
    expect(headingLabel('Pengalaman', getSpec('executive'))).toBe('Pengalaman')
    expect(
      headingLabel('Pengalaman', {
        ...getSpec('executive'),
        headingStyle: { ...getSpec('executive').headingStyle, transform: 'none' },
      }),
    ).toBe('Pengalaman')
  })

  it('contactLine membuang bagian kosong dan memakai separator spec', () => {
    const spec = getSpec('ledger')
    expect(contactLine(['a@b.test', undefined, 'Jakarta'], spec)).toBe('a@b.test · Jakarta')
    expect(contactLine([undefined, undefined], spec)).toBe('')
    expect(contactLine([], spec)).toBe('')
    expect(
      contactLine(['', 'x'], { ...spec, contactStyle: { separator: ' | ', align: 'left' } }),
    ).toBe('x')
  })
})
