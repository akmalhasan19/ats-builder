export const ACTION_VERBS = new Set([
  'achieved',
  'achieve',
  'analyzed',
  'analysed',
  'architected',
  'automated',
  'built',
  'coordinated',
  'created',
  'delivered',
  'deployed',
  'designed',
  'developed',
  'directed',
  'established',
  'engineered',
  'grew',
  'implemented',
  'improved',
  'increased',
  'initiated',
  'integrated',
  'launched',
  'led',
  'managed',
  'mentored',
  'migrated',
  'maintained',
  'modernized',
  'negotiated',
  'optimized',
  'optimised',
  'organized',
  'originated',
  'overhauled',
  'oversaw',
  'presented',
  'prevented',
  'produced',
  'programmed',
  'reduced',
  'resolved',
  'restructured',
  'rewrote',
  'saved',
  'scaled',
  'shipped',
  'spearheaded',
  'standardized',
  'streamlined',
  'trained',
  'transformed',
  'won',
  'wrote',
  'membangun',
  'membimbing',
  'mendirikan',
  'menganalisis',
  'mengautomasi',
  'mengelola',
  'mengembangkan',
  'mengintegrasikan',
  'mengkoordinasi',
  'mengoptimalkan',
  'mengurangi',
  'meningkatkan',
  'menulis',
  'menyelesaikan',
  'merancang',
  'memimpin',
  'memelihara',
  'membuat',
  'meluncurkan',
  'memigrasikan',
  'mengawasi',
  'memulai',
  'memperbaiki',
  'memangkas',
  'menyusun',
  'melatih',
  'menciptakan',
  'menstandarkan',
  'mengganti',
])

export function wordCount(text: string): number {
  const trimmed = text.trim()
  if (trimmed === '') return 0
  return trimmed.split(/\s+/).length
}

export function charLen(text: string): number {
  return text.length
}

export function startsWithActionVerb(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  // split dengan limit 1 pada string non-kosong selalu menghasilkan elemen ke-0.
  const firstWord = trimmed.split(/\s/, 1)[0] as string
  return ACTION_VERBS.has(firstWord.toLowerCase())
}

export function containsMetric(text: string): boolean {
  return /\d/.test(text)
}

export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function tokenize(text: string): string[] {
  return stripDiacritics(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
}

export function slugify(value: string): string {
  const slug = stripDiacritics(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'resume'
}
