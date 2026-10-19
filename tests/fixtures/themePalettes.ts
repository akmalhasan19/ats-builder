import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Membaca palette tema langsung dari `src/styles/themes.css` supaya test tidak
 * mengawetkan salinan hex. Satu blok = satu tema; blok `:root` adalah default.
 */
export type ThemePalette = {
  id: string
  accent: string
  accentActive: string
  accentInk: string
  accentOn: string
  accentWash: string
  secondary: string
  secondaryDim: string
  secondaryWash: string
}

const THEMES_CSS = readFileSync(path.join(process.cwd(), 'src/styles/themes.css'), 'utf8')

const REQUIRED = [
  'accent',
  'accent-active',
  'accent-ink',
  'accent-on',
  'accent-wash',
  'secondary',
  'secondary-dim',
  'secondary-wash',
] as const

const readVars = (block: string): Record<string, string> => {
  const vars: Record<string, string> = {}
  for (const match of block.matchAll(/--theme-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = match
    if (name && value) vars[name] = value.toLowerCase()
  }
  return vars
}

const toPalette = (id: string, block: string): ThemePalette => {
  const vars = readVars(block)
  for (const key of REQUIRED) {
    if (!vars[key]) throw new Error(`Tema "${id}" tidak mendefinisikan --theme-${key}`)
  }
  return {
    id,
    accent: vars.accent!,
    accentActive: vars['accent-active']!,
    accentInk: vars['accent-ink']!,
    accentOn: vars['accent-on']!,
    accentWash: vars['accent-wash']!,
    secondary: vars.secondary!,
    secondaryDim: vars['secondary-dim']!,
    secondaryWash: vars['secondary-wash']!,
  }
}

export function readThemePalettes(): ThemePalette[] {
  const root = /:root\s*\{([\s\S]*?)\}/.exec(THEMES_CSS)
  if (!root?.[1]) throw new Error('themes.css tidak punya blok :root untuk tema default')

  const palettes: ThemePalette[] = [toPalette('vetra', root[1])]
  for (const match of THEMES_CSS.matchAll(/:root\[data-theme='([a-z]+)'\]\s*\{([\s\S]*?)\}/g)) {
    const [, id, block] = match
    if (id && block) palettes.push(toPalette(id, block))
  }
  return palettes
}

/** Palette default (Vetra) — dipakai test kontras chrome. */
export const DEFAULT_PALETTE = readThemePalettes()[0]!
