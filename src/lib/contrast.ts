/**
 * Rasio kontras WCAG 2.1 (AA). Dibutuhkan aturan `forbidden` T7.1: aksen warna
 * yang dipilih pengguna harus tetap terbaca di atas kertas putih.
 */
export type Rgb = { r: number; g: number; b: number }

export function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '')
  const full =
    value.length === 3
      ? [...value].map((ch) => ch + ch).join('')
      : value.length === 6
        ? value
        : null
  if (full === null || !/^[0-9a-f]{6}$/i.test(full)) return null
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  }
}

const channel = (value: number): number => {
  const ratio = value / 255
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(foreground: string, background: string): number | null {
  const a = parseHex(foreground)
  const b = parseHex(background)
  if (!a || !b) return null
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
