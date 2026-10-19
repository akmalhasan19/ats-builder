import type { SectionInstance } from '@/types/resume'
import type { ResumeDoc } from '@/types/resume'
import type { AtsIssue } from '../types'
import { startsWithActionVerb, startsWithPassive } from './verbs'

/**
 * T7.1 `bullets.ts` — panjang 40–180 karakter (bad bila < 25 atau > 220),
 * diawali kata kerja aksi, ada angka (advisory), tidak diawali kalimat pasif.
 */

const MIN_IDEAL = 40
const MAX_IDEAL = 180
const MIN_HARD = 25
const MAX_HARD = 220

/** Awalan id field per jenis bagian — mengikuti konvensi editor Fase 3. */
const FIELD_PREFIX: Record<string, string> = {
  experience: 'exp',
  education: 'edu',
  projects: 'proj',
  volunteering: 'vol',
  certifications: 'cert',
  awards: 'award',
}

const bulletFieldId = (kind: string, entryId: string, index: number): string =>
  `${FIELD_PREFIX[kind] ?? kind}-${entryId}-bullet-${index}`

type BulletRef = {
  sectionId: string
  kind: string
  entryId: string
  index: number
  text: string
}

const bulletsOf = (doc: ResumeDoc): BulletRef[] => {
  const refs: BulletRef[] = []
  for (const section of doc.sections as SectionInstance[]) {
    if (!section.visible) continue
    if (section.kind === 'profile' || section.kind === 'summary' || section.kind === 'skills')
      continue
    if (!('entries' in section.data)) continue
    for (const entry of section.data.entries) {
      const holder = entry as { id?: string; bullets?: string[] }
      const entryId = typeof holder.id === 'string' ? holder.id : ''
      if (!entryId || !Array.isArray(holder.bullets)) continue
      holder.bullets.forEach((text, index) => {
        refs.push({ sectionId: section.id, kind: section.kind, entryId, index, text })
      })
    }
  }
  return refs
}

export function checkBullets(doc: ResumeDoc): AtsIssue[] {
  const issues: AtsIssue[] = []
  const refs = bulletsOf(doc).filter((ref) => ref.text.trim() !== '')

  let badShort = 0
  let badLong = 0
  let warnShort = 0
  let warnLong = 0
  let passive = 0
  let noVerb = 0
  let noMetric = 0
  let ideal = 0

  for (const ref of refs) {
    const length = ref.text.trim().length
    // Id field mengikuti jenis bagian entri (konvensi editor Fase 3), supaya
    // tombol `Perbaiki →` bisa memfokuskan textarea yang tepat.
    const fixTarget = {
      sectionId: ref.sectionId,
      entryId: ref.entryId,
      field: bulletFieldId(ref.kind, ref.entryId, ref.index),
    }

    if (length < MIN_HARD) {
      badShort += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.tooShort`,
        ruleId: 'bullets.length',
        severity: 'bad',
        titleId: 'ats.bullets.tooShortBad.title',
        detailId: 'ats.bullets.tooShortBad.detail',
        points: 12,
        params: { length, min: MIN_HARD },
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    } else if (length < MIN_IDEAL) {
      warnShort += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.short`,
        ruleId: 'bullets.length',
        severity: 'warn',
        titleId: 'ats.bullets.tooShortWarn.title',
        detailId: 'ats.bullets.tooShortWarn.detail',
        points: 4,
        params: { length, min: MIN_IDEAL },
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    } else if (length > MAX_HARD) {
      badLong += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.tooLong`,
        ruleId: 'bullets.length',
        severity: 'bad',
        titleId: 'ats.bullets.tooLongBad.title',
        detailId: 'ats.bullets.tooLongBad.detail',
        points: 12,
        params: { length, max: MAX_HARD },
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    } else if (length > MAX_IDEAL) {
      warnLong += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.long`,
        ruleId: 'bullets.length',
        severity: 'warn',
        titleId: 'ats.bullets.tooLongWarn.title',
        detailId: 'ats.bullets.tooLongWarn.detail',
        points: 4,
        params: { length, max: MAX_IDEAL },
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    } else {
      ideal += 1
    }

    if (startsWithPassive(ref.text)) {
      passive += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.passive`,
        ruleId: 'bullets.passive',
        severity: 'warn',
        titleId: 'ats.bullets.passiveWarn.title',
        detailId: 'ats.bullets.passiveWarn.detail',
        points: 4,
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    } else if (!startsWithActionVerb(ref.text)) {
      noVerb += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.verb`,
        ruleId: 'bullets.verb',
        severity: 'warn',
        titleId: 'ats.bullets.verbWarn.title',
        detailId: 'ats.bullets.verbWarn.detail',
        points: 4,
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    }

    if (!/\d/.test(ref.text)) {
      noMetric += 1
      issues.push({
        id: `bullets.${ref.entryId}.${ref.index}.metric`,
        ruleId: 'bullets.metric',
        severity: 'info',
        titleId: 'ats.bullets.metricInfo.title',
        detailId: 'ats.bullets.metricInfo.detail',
        points: 1,
        target: fixTarget,
        fixHintId: 'ats.fix.rewriteBullet',
      })
    }
  }

  issues.push({
    id: 'bullets.summary',
    ruleId: 'bullets.summary',
    severity: 'ok',
    titleId: 'ats.bullets.summaryOk.title',
    detailId: 'ats.bullets.summaryOk.detail',
    points: 0,
    params: {
      ideal,
      total: refs.length,
      badShort,
      badLong,
      warnShort,
      warnLong,
      passive,
      noVerb,
      noMetric,
    },
  })

  return issues
}
