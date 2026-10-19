import type { ResumeDoc } from '@/types/resume'
import type { AtsIssue, AtsReport } from './types'
import { checkContact } from './rules/contact'
import { checkSections } from './rules/sections'
import { checkBullets } from './rules/bullets'
import { checkDates } from './rules/dates'
import { checkLength } from './rules/length'
import { checkForbidden } from './rules/forbidden'
import { checkConsistency } from './rules/consistency'
import { matchKeywords } from './rules/keywords'
import { bandOf, scoreOf } from './scoring'

/**
 * T7.1/T7.2 — satu pintu pemeriksaan. Urutan rule menentukan urutan isu di
 * drawer; pengelompokan severity dilakukan UI, bukan di sini.
 */

const RULES: ((doc: ResumeDoc) => AtsIssue[])[] = [
  checkContact,
  checkSections,
  checkBullets,
  checkDates,
  checkConsistency,
  checkForbidden,
]

export function collectIssues(doc: ResumeDoc, pageCount: number): AtsIssue[] {
  const issues: AtsIssue[] = []
  for (const rule of RULES) issues.push(...rule(doc))
  issues.push(...checkLength(doc, pageCount))
  return issues
}

export function buildReport(doc: ResumeDoc, pageCount: number, checkedAt: number): AtsReport {
  const issues = collectIssues(doc, pageCount)
  const score = scoreOf(issues)
  return {
    issues,
    score,
    band: bandOf(score),
    keywords: matchKeywords(doc),
    pageCount,
    checkedAt,
  }
}

/**
 * Penanda isi dokumen untuk memicu pemeriksaan ulang. `meta.lastCheckedAt`
 * sengaja dikeluarkan: kalau ikut, setiap pemeriksaan menulis dokumen dan
 * memicu pemeriksaan berikutnya tanpa henti.
 */
export function docSignature(doc: ResumeDoc): string {
  const { meta, ...rest } = doc
  void meta
  return JSON.stringify(rest)
}
