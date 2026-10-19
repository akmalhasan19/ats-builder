import { sectionRegistry } from '@/features/sections/registry'
import { t } from '@/lib/i18n'
import type { SectionKind } from '@/schema/resume'
import type { ResumeDoc } from '@/types/resume'
import type { AtsIssue } from '../types'
import { isCanonicalHeading } from './headings'

/**
 * T7.1 `sections.ts` — kehadiran bagian inti dan kekanonisan judulnya.
 * Bagian yang disembunyikan tidak ikut ter-render, jadi bagi parser ia tidak
 * ada — meski datanya masih tersimpan.
 */

/** Bagian inti + bobotnya: pengalaman wajib, sisanya sangat dianjurkan. */
const CORE: readonly { kind: SectionKind; severity: 'bad' | 'warn' }[] = [
  { kind: 'experience', severity: 'bad' },
  { kind: 'education', severity: 'warn' },
  { kind: 'skills', severity: 'warn' },
  { kind: 'summary', severity: 'warn' },
]

export function checkSections(doc: ResumeDoc): AtsIssue[] {
  const issues: AtsIssue[] = []
  const visible = new Set(
    doc.sections.filter((section) => section.visible).map((section) => section.kind),
  )

  for (const { kind, severity } of CORE) {
    const label = t(sectionRegistry[kind].labelId)
    if (visible.has(kind)) {
      issues.push({
        id: `sections.${kind}.ok`,
        ruleId: 'sections.presence',
        severity: 'ok',
        titleId: 'ats.sections.presentOk.title',
        detailId: 'ats.sections.presentOk.detail',
        points: 0,
        params: { section: label },
      })
      continue
    }
    const hidden = doc.sections.find((section) => section.kind === kind)
    issues.push({
      id: `sections.${kind}.missing`,
      ruleId: 'sections.presence',
      severity,
      titleId:
        severity === 'bad' ? 'ats.sections.missingBad.title' : 'ats.sections.missingWarn.title',
      detailId:
        severity === 'bad' ? 'ats.sections.missingBad.detail' : 'ats.sections.missingWarn.detail',
      points: severity === 'bad' ? 12 : 4,
      params: { section: label },
      target: hidden ? { sectionId: hidden.id } : undefined,
      fixHintId: hidden ? 'ats.fix.showSection' : 'ats.fix.addSection',
    })
  }

  for (const section of doc.sections) {
    if (!section.visible || section.kind === 'profile') continue
    const label = t(sectionRegistry[section.kind].labelId)
    if (isCanonicalHeading(section.kind, label)) continue
    issues.push({
      id: `sections.${section.id}.heading`,
      ruleId: 'sections.heading',
      severity: 'warn',
      titleId: 'ats.sections.headingWarn.title',
      detailId: 'ats.sections.headingWarn.detail',
      points: 4,
      params: { section: label },
      target: { sectionId: section.id },
      fixHintId: 'ats.fix.renameSection',
    })
  }

  return issues
}
