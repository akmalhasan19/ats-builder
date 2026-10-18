import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Sumber kebenaran warna tetap tokens.css, bukan salinan di test.
const css = readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

const HEX_PATTERN = /--color-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi
const RGBA_PATTERN = /--color-([a-z-]+):\s*rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)\s*;/gi

const hexTokens = new Map<string, string>()
for (const match of css.matchAll(HEX_PATTERN)) {
  const [, name, value] = match
  if (name && value) hexTokens.set(name, value.toLowerCase())
}

const rgbaTokens = new Map<string, [number, number, number, number]>()
for (const match of css.matchAll(RGBA_PATTERN)) {
  const [, name, r, g, b, a] = match
  if (name) rgbaTokens.set(name, [Number(r), Number(g), Number(b), Number(a)])
}

const hexFor = (name: string): string => {
  const value = hexTokens.get(name)
  if (!value) throw new Error(`Token warna --color-${name} tidak ditemukan di tokens.css`)
  return value
}

const toRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ]
}

const luminance = ([r, g, b]: [number, number, number]): number => {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a: string, b: string): number => {
  const la = luminance(toRgb(a))
  const lb = luminance(toRgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Wash ditumpuk di atas kertas (raised) — sama seperti di layar. */
const blendOver = (washName: string, base: string): string => {
  const solid = hexTokens.get(washName)
  if (solid) return solid
  const overlay = rgbaTokens.get(washName)
  if (!overlay) throw new Error(`Token --color-${washName} tidak ditemukan`)
  const [r, g, b, alpha] = overlay
  const [br, bg, bb] = toRgb(base)
  const channel = (top: number, bottom: number) =>
    Math.round(top * alpha + bottom * (1 - alpha))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r, br)}${channel(g, bg)}${channel(b, bb)}`
}

type Pair = { text: string; background: string; min: number; role: string }

const raised = hexFor('raised')
const surface = hexFor('surface')
const sunken = hexFor('sunken')
const highlighter = hexFor('highlighter')
const machine = hexFor('machine')

const chromeBases = [
  { name: 'raised', hex: raised },
  { name: 'surface', hex: surface },
  { name: 'sunken', hex: sunken },
]

const pairs: Pair[] = [
  ...chromeBases.map((base) => ({
    text: hexFor('ink'),
    background: base.hex,
    min: 4.5,
    role: `teks utama di ${base.name}`,
  })),
  ...chromeBases.map((base) => ({
    text: hexFor('ink-secondary'),
    background: base.hex,
    min: 4.5,
    role: `teks pendukung di ${base.name}`,
  })),
  ...chromeBases.map((base) => ({
    text: hexFor('ink-tertiary'),
    background: base.hex,
    min: 4.5,
    role: `eyebrow/caption/hint di ${base.name}`,
  })),
  { text: hexFor('cyanotype'), background: raised, min: 4.5, role: 'aksen cyanotype di kertas' },
  { text: hexFor('cyanotype'), background: surface, min: 4.5, role: 'aksen cyanotype di pane' },
  { text: hexFor('cyanotype'), background: sunken, min: 4.5, role: 'aksen cyanotype di rail' },
  {
    text: hexFor('cyanotype'),
    background: blendOver('cyanotype-wash', raised),
    min: 4.5,
    role: 'teks aktif di atas wash',
  },
  { text: hexFor('signal-ok'), background: raised, min: 4.5, role: 'sinyal ok di kertas' },
  {
    text: hexFor('signal-ok'),
    background: blendOver('ok-wash', raised),
    min: 4.5,
    role: 'badge ok',
  },
  { text: hexFor('signal-warn'), background: raised, min: 4.5, role: 'sinyal warn di kertas' },
  {
    text: hexFor('signal-warn'),
    background: blendOver('warn-wash', raised),
    min: 4.5,
    role: 'badge warn',
  },
  { text: hexFor('signal-bad'), background: raised, min: 4.5, role: 'sinyal bad di kertas' },
  {
    text: hexFor('signal-bad'),
    background: blendOver('bad-wash', raised),
    min: 4.5,
    role: 'badge bad',
  },
  { text: hexFor('machine-text'), background: machine, min: 4.5, role: 'Parse Tape' },
  { text: hexFor('machine-dim'), background: machine, min: 4.5, role: 'tag Parse Tape' },
  { text: hexFor('ink'), background: highlighter, min: 4.5, role: 'teks di atas stabilo' },
  { text: hexFor('cyanotype'), background: raised, min: 3, role: 'ring fokus' },
  { text: hexFor('ink-tertiary'), background: raised, min: 3, role: 'ikon redup' },
]

describe('audit kontras token (§2.2, T2.5)', () => {
  for (const pair of pairs) {
    it(`${pair.role}: ${pair.text} di ${pair.background} ≥ ${pair.min}:1`, () => {
      const ratio = contrast(pair.text, pair.background)
      expect(ratio, `${pair.role} hanya ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(pair.min)
    })
  }

  it('setiap token dasar yang dipakai komponen benar-benar ada di tokens.css', () => {
    expect(hexTokens.size).toBeGreaterThanOrEqual(19)
    expect(rgbaTokens.size).toBeGreaterThanOrEqual(4)
  })
})
