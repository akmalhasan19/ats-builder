import { tokenize } from '@/lib/text'
import type { ResumeDoc } from '@/types/resume'
import type { KeywordMatch } from '../types'

/**
 * T7.1 `keywords.ts` — kata kunci lowongan vs isi dokumen. Yang dihitung hanya
 * istilah yang muncul ≥ 2 kali atau istilah multi-kata; sisanya noise.
 */

const STOPWORDS = new Set([
  // Indonesia
  'dan',
  'atau',
  'yang',
  'untuk',
  'dengan',
  'dari',
  'di',
  'ke',
  'pada',
  'dalam',
  'adalah',
  'akan',
  'juga',
  'kami',
  'kita',
  'anda',
  'saya',
  'dia',
  'mereka',
  'ini',
  'itu',
  'jika',
  'jadi',
  'serta',
  'namun',
  'agar',
  'sebagai',
  'oleh',
  'karena',
  'harus',
  'dapat',
  'bisa',
  'memiliki',
  'punya',
  'lebih',
  'sangat',
  'per',
  'tahun',
  'bulan',
  'hari',
  'kerja',
  'perusahaan',
  'posisi',
  'lowongan',
  'kandidat',
  'pelamar',
  'tim',
  'pengalaman',
  'kemampuan',
  'keterampilan',
  'bertanggung',
  'jawab',
  'bertanggungjawab',
  'tugas',
  'minimal',
  'maksimal',
  'diutamakan',
  'menjadi',
  'melakukan',
  'menggunakan',
  'terbaik',
  'baik',
  // Inggris
  'the',
  'and',
  'or',
  'for',
  'with',
  'from',
  'in',
  'on',
  'at',
  'to',
  'of',
  'a',
  'an',
  'is',
  'are',
  'be',
  'been',
  'we',
  'you',
  'your',
  'our',
  'us',
  'they',
  'their',
  'this',
  'that',
  'if',
  'so',
  'as',
  'by',
  'because',
  'must',
  'can',
  'will',
  'should',
  'have',
  'has',
  'had',
  'more',
  'most',
  'very',
  'per',
  'year',
  'years',
  'month',
  'months',
  'work',
  'working',
  'team',
  'teams',
  'company',
  'role',
  'position',
  'candidate',
  'applicant',
  'experience',
  'skills',
  'skill',
  'ability',
  'abilities',
  'responsibilities',
  'responsible',
  'duties',
  'minimum',
  'maximum',
  'preferred',
  'plus',
  'nice',
  'good',
  'strong',
  'new',
  'using',
  'use',
  'join',
])

const MIN_FREQ = 2
const MIN_TOKEN_LENGTH = 3
/** Daftar dibatasi: panel ringkasan harus bisa dipindai, bukan digulir panjang. */
const MAX_TERMS = 20

const meaningful = (token: string): boolean =>
  token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token) && !/^\d+$/.test(token)

export type KeywordSet = {
  /** Kata kunci terurut: yang paling sering muncul di lowongan lebih dulu. */
  terms: string[]
  frequency: Map<string, number>
}

export function extractKeywords(jobDescription: string): KeywordSet {
  const tokens = tokenize(jobDescription)
  const frequency = new Map<string, number>()
  for (const token of tokens) {
    if (!meaningful(token)) continue
    frequency.set(token, (frequency.get(token) ?? 0) + 1)
  }

  // Istilah multi-kata: dua token berurutan yang keduanya bermakna, mis.
  // "machine learning" — parser lowongan mencari frasa utuh seperti ini.
  const pairs: string[] = []
  for (let index = 1; index < tokens.length; index += 1) {
    const left = tokens[index - 1]
    const right = tokens[index]
    if (left === undefined || right === undefined) continue
    if (!meaningful(left) || !meaningful(right)) continue
    pairs.push(`${left} ${right}`)
  }
  for (const pair of pairs) frequency.set(pair, (frequency.get(pair) ?? 0) + 1)

  const terms = [...frequency.entries()]
    .filter(([term, count]) => (term.includes(' ') ? count >= 1 : count >= MIN_FREQ))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TERMS)
    .map(([term]) => term)

  return { terms, frequency }
}

const documentTokens = (doc: ResumeDoc): Set<string> => {
  const parts: string[] = []
  for (const section of doc.sections) {
    if (!section.visible) continue
    if (section.kind === 'summary') {
      parts.push(section.data.text)
      continue
    }
    if (section.kind === 'profile') {
      parts.push(section.data.headline)
      continue
    }
    if (section.kind === 'skills') {
      for (const group of section.data.groups) parts.push(group.name, group.items.join(' '))
      continue
    }
    for (const entry of section.data.entries) {
      const holder = entry as Record<string, unknown>
      for (const value of Object.values(holder)) {
        if (typeof value === 'string') parts.push(value)
        else if (Array.isArray(value))
          parts.push(value.filter((v) => typeof v === 'string').join(' '))
      }
    }
  }
  return new Set(tokenize(parts.join(' ')))
}

const hasTerm = (tokens: Set<string>, term: string): boolean => {
  if (!term.includes(' ')) return tokens.has(term)
  const pieces = tokenize(term)
  return pieces.length > 0 && pieces.every((piece) => tokens.has(piece))
}

export function matchKeywords(doc: ResumeDoc): KeywordMatch | null {
  if (!doc.jobDescription || doc.jobDescription.trim() === '') return null
  const { terms } = extractKeywords(doc.jobDescription)
  if (terms.length === 0) return null

  const tokens = documentTokens(doc)
  const matched: string[] = []
  const missing: string[] = []
  for (const term of terms) {
    if (hasTerm(tokens, term)) matched.push(term)
    else missing.push(term)
  }

  return {
    matched,
    missing,
    density: terms.length === 0 ? 0 : Math.round((matched.length / terms.length) * 100) / 100,
  }
}
