import { sectionRegistry } from '@/features/sections/registry'
import { t } from '@/lib/i18n'
import type { ISOYearMonth, ResumeDoc } from '@/types/resume'
import type { AtsIssue } from '../types'

/**
 * T7.1 `consistency.ts` — format tanggal seragam, kapitalisasi heading seragam,
 * dan akhir tanda baca bullet seragam. Parser menyukai pola yang berulang.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export type Casing = 'upper' | 'title' | 'lower' | 'mixed'

export const casingOf = (label: string): Casing => {
  const letters = label.replace(/[^\p{L}]/gu, '')
  if (letters === '') return 'mixed'
  if (label === label.toUpperCase()) return 'upper'
  if (label === label.toLowerCase()) return 'lower'
  const words = label.split(/\s+/).filter(Boolean)
  const titled = words.every((word) => word[0] === undefined || word[0] === word[0]!.toUpperCase())
  return titled ? 'title' : 'mixed'
}

/**
 * Heading seragam = satu gaya penulisan untuk semua judul bagian. Label bagian
 * datang dari registry (bukan dari data), jadi di aplikasi ini ia selalu seragam;
 * aturan ini menjaga kalau label custom masuk kemudian — mis. lewat impor.
 */
export function headingCasingIssue(labels: readonly string[]): AtsIssue | null {
  if (labels.length < 2) return null
  const styles = new Set(labels.map(casingOf))
  if (styles.size < 2) return null
  return {
    id: 'consistency.headingCasing',
    ruleId: 'consistency.headingCasing',
    severity: 'info',
    titleId: 'ats.consistency.casingInfo.title',
    detailId: 'ats.consistency.casingInfo.detail',
    points: 1,
    params: { count: styles.size },
    fixHintId: 'ats.fix.uniformHeadings',
  }
}

const allDates = (
  doc: ResumeDoc,
): { value: ISOYearMonth | ''; sectionId: string; entryId: string }[] => {
  const values: { value: ISOYearMonth | ''; sectionId: string; entryId: string }[] = []
  for (const section of doc.sections) {
    if (!section.visible) continue
    if (section.kind === 'profile' || section.kind === 'summary' || section.kind === 'skills')
      continue
    for (const entry of section.data.entries) {
      const holder = entry as {
        id?: string
        startDate?: string
        endDate?: string
        issuedAt?: string
        awardedAt?: string
      }
      const entryId = String(holder.id ?? '')
      for (const value of [holder.startDate, holder.endDate, holder.issuedAt, holder.awardedAt]) {
        if (typeof value === 'string' && value !== '')
          values.push({ value, sectionId: section.id, entryId })
      }
    }
  }
  return values
}

const allBullets = (doc: ResumeDoc): string[] => {
  const bullets: string[] = []
  for (const section of doc.sections) {
    if (!section.visible) continue
    if (section.kind === 'profile' || section.kind === 'summary' || section.kind === 'skills')
      continue
    for (const entry of section.data.entries) {
      const holder = entry as { bullets?: string[] }
      if (Array.isArray(holder.bullets)) bullets.push(...holder.bullets)
    }
  }
  return bullets.filter((text) => text.trim() !== '')
}

export function checkConsistency(doc: ResumeDoc): AtsIssue[] {
  const issues: AtsIssue[] = []

  const dates = allDates(doc)
  const malformed = dates.filter((item) => !MONTH_RE.test(item.value))
  if (malformed.length > 0) {
    issues.push({
      id: 'consistency.dateFormat',
      ruleId: 'consistency.dateFormat',
      severity: 'warn',
      titleId: 'ats.consistency.dateFormatWarn.title',
      detailId: 'ats.consistency.dateFormatWarn.detail',
      points: 4,
      params: { count: malformed.length, sample: malformed[0]?.value ?? '' },
      target: malformed[0]
        ? { sectionId: malformed[0]!.sectionId, entryId: malformed[0]!.entryId }
        : undefined,
      fixHintId: 'ats.fix.fillField',
    })
  }

  const labels = doc.sections
    .filter((section) => section.visible && section.kind !== 'profile')
    .map((section) => t(sectionRegistry[section.kind].labelId))
  const casings = labels.map(casingOf)
  if (casings.length > 1 && new Set(casings).size > 1) {
    issues.push(headingCasingIssue(labels)!)
  }

  const bullets = allBullets(doc)
  const withPeriod = bullets.filter((text) => text.trim().endsWith('.')).length
  const withoutPeriod = bullets.length - withPeriod
  if (bullets.length > 1 && withPeriod > 0 && withoutPeriod > 0) {
    issues.push({
      id: 'consistency.bulletPunctuation',
      ruleId: 'consistency.bulletPunctuation',
      severity: 'info',
      titleId: 'ats.consistency.punctuationInfo.title',
      detailId: 'ats.consistency.punctuationInfo.detail',
      points: 1,
      params: { withPeriod, withoutPeriod },
      fixHintId: 'ats.fix.uniformPunctuation',
    })
  }

  if (issues.length === 0) {
    issues.push({
      id: 'consistency.summary',
      ruleId: 'consistency.summary',
      severity: 'ok',
      titleId: 'ats.consistency.summaryOk.title',
      detailId: 'ats.consistency.summaryOk.detail',
      points: 0,
      params: { dates: dates.length, bullets: bullets.length },
    })
  }

  return issues
}
