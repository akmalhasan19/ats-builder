import { contrastRatio } from '@/lib/contrast'
import { getSpec } from '@/features/templates/specs'
import type { ResumeDoc, TemplateId } from '@/types/resume'
import type { AtsIssue } from '../types'

/**
 * T7.1 `forbidden.ts` — hal-hal yang merusak parsing: foto, aksen dengan
 * kontras di bawah AA, template non-ATS, dan level keahlian berangka.
 */

const MIN_CONTRAST = 4.5
const PAPER_HEX = '#FFFFFF'

/** Guard: template di luar daftar ini dianggap belum teruji ATS. */
const ATS_SAFE_TEMPLATES: readonly TemplateId[] = [
  'classic-ats',
  'ledger',
  'executive',
  'minimal',
  'technician',
]

/** "React 90%", "SQL 5/5", "Level 3", "Python (4/5)" — rating jadi teks. */
const NUMERIC_LEVEL_RE = /(\b\d{1,3}\s*%)|(\b\d\s*\/\s*\d\b)|(\blevel\s*\d\b)/i

export function checkForbidden(doc: ResumeDoc): AtsIssue[] {
  const issues: AtsIssue[] = []

  const profile = doc.sections.find((section) => section.kind === 'profile')
  if (profile?.kind === 'profile' && profile.data.photoEnabled) {
    issues.push({
      id: 'forbidden.photo',
      ruleId: 'forbidden.photo',
      severity: 'bad',
      titleId: 'ats.forbidden.photoBad.title',
      detailId: 'ats.forbidden.photoBad.detail',
      points: 12,
      target: { sectionId: profile.id },
      fixHintId: 'ats.fix.removePhoto',
    })
  }

  const accentHex = doc.theme.accentHex
  if (accentHex) {
    const ratio = contrastRatio(accentHex, PAPER_HEX)
    if (ratio === null || ratio < MIN_CONTRAST) {
      issues.push({
        id: 'forbidden.accentContrast',
        ruleId: 'forbidden.accent',
        severity: 'bad',
        titleId: 'ats.forbidden.accentBad.title',
        detailId: 'ats.forbidden.accentBad.detail',
        points: 12,
        params: { ratio: ratio === null ? 0 : Math.round(ratio * 100) / 100, min: MIN_CONTRAST },
        fixHintId: 'ats.fix.disableAccent',
      })
    }
  }

  if (
    !ATS_SAFE_TEMPLATES.includes(doc.templateId) ||
    getSpec(doc.templateId).id !== doc.templateId
  ) {
    issues.push({
      id: 'forbidden.template',
      ruleId: 'forbidden.template',
      severity: 'bad',
      titleId: 'ats.forbidden.templateBad.title',
      detailId: 'ats.forbidden.templateBad.detail',
      points: 12,
      fixHintId: 'ats.fix.pickTemplate',
    })
  }

  for (const section of doc.sections) {
    if (!section.visible || section.kind !== 'skills') continue
    for (const group of section.data.groups) {
      const rated = group.items.filter((item) => NUMERIC_LEVEL_RE.test(item))
      if (rated.length === 0) continue
      issues.push({
        id: `forbidden.skillLevel.${group.id}`,
        ruleId: 'forbidden.skillLevel',
        severity: 'warn',
        titleId: 'ats.forbidden.skillLevelWarn.title',
        detailId: 'ats.forbidden.skillLevelWarn.detail',
        points: 4,
        params: { group: group.name, sample: rated[0] ?? '' },
        target: {
          sectionId: section.id,
          entryId: group.id,
          field: `skill-group-${group.id}-items`,
        },
        fixHintId: 'ats.fix.removeLevel',
      })
    }
  }

  if (issues.length === 0) {
    issues.push({
      id: 'forbidden.summary',
      ruleId: 'forbidden.summary',
      severity: 'ok',
      titleId: 'ats.forbidden.summaryOk.title',
      detailId: 'ats.forbidden.summaryOk.detail',
      points: 0,
    })
  }

  return issues
}
