import type { ResumeDoc } from '@/types/resume'
import type { AtsIssue } from '../types'
import { monthsOfExperience } from './dates'

/**
 * T7.1 `length.ts` — 1 halaman untuk < 3 tahun pengalaman, maksimal 2 halaman
 * untuk ≥ 3 tahun; lebih dari 3 halaman selalu jadi peringatan.
 */

const JUNIOR_MONTHS = 36
const JUNIOR_MAX_PAGES = 1
const SENIOR_MAX_PAGES = 2
const HARD_MAX_PAGES = 3

export function checkLength(doc: ResumeDoc, pageCount: number): AtsIssue[] {
  const months = monthsOfExperience(doc)
  const years = Math.round((months / 12) * 10) / 10
  const limit = months < JUNIOR_MONTHS ? JUNIOR_MAX_PAGES : SENIOR_MAX_PAGES
  const issues: AtsIssue[] = []

  if (pageCount > HARD_MAX_PAGES) {
    issues.push({
      id: 'length.tooManyPages',
      ruleId: 'length.pages',
      severity: 'warn',
      titleId: 'ats.length.tooManyWarn.title',
      detailId: 'ats.length.tooManyWarn.detail',
      points: 4,
      params: { pages: pageCount, max: HARD_MAX_PAGES },
      fixHintId: 'ats.fix.trimContent',
    })
  } else if (pageCount > limit) {
    issues.push({
      id: 'length.overLimit',
      ruleId: 'length.pages',
      severity: 'warn',
      titleId: 'ats.length.overLimitWarn.title',
      detailId: 'ats.length.overLimitWarn.detail',
      points: 4,
      params: { pages: pageCount, max: limit, years },
      fixHintId: 'ats.fix.trimContent',
    })
  } else {
    issues.push({
      id: 'length.summary',
      ruleId: 'length.pages',
      severity: 'ok',
      titleId: 'ats.length.summaryOk.title',
      detailId: 'ats.length.summaryOk.detail',
      points: 0,
      params: { pages: pageCount, max: limit, years },
    })
  }

  return issues
}
