import type { ResumeDoc } from '@/types/resume'
import type { ProfileData } from '@/types/resume'
import type { AtsIssue } from '../types'

/**
 * T7.1 `contact.ts` — email valid, telepon ≥ 8 digit setelah normalisasi,
 * lokasi ada, dan ≥ 1 tautan profil (advisory).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PHONE_DIGITS = 8

const profileOf = (doc: ResumeDoc): { id: string; data: ProfileData } | null => {
  const section = doc.sections.find((item) => item.kind === 'profile')
  if (!section || section.kind !== 'profile') return null
  return { id: section.id, data: section.data }
}

export const phoneDigits = (phone: string): number => (phone.match(/\d/g) ?? []).length

export function checkContact(doc: ResumeDoc): AtsIssue[] {
  const profile = profileOf(doc)
  if (!profile) return []
  const { data } = profile
  const target = { sectionId: profile.id }
  const issues: AtsIssue[] = []

  if (data.email.trim() === '') {
    issues.push({
      id: 'contact.email.missing',
      ruleId: 'contact.email',
      severity: 'bad',
      titleId: 'ats.contact.emailMissing.title',
      detailId: 'ats.contact.emailMissing.detail',
      points: 12,
      target: { ...target, field: 'profile-email' },
      fixHintId: 'ats.fix.fillField',
    })
  } else if (!EMAIL_RE.test(data.email.trim())) {
    issues.push({
      id: 'contact.email.invalid',
      ruleId: 'contact.email',
      severity: 'bad',
      titleId: 'ats.contact.emailInvalid.title',
      detailId: 'ats.contact.emailInvalid.detail',
      points: 12,
      params: { value: data.email.trim() },
      target: { ...target, field: 'profile-email' },
      fixHintId: 'ats.fix.fillField',
    })
  } else {
    issues.push({
      id: 'contact.email.ok',
      ruleId: 'contact.email',
      severity: 'ok',
      titleId: 'ats.contact.emailOk.title',
      detailId: 'ats.contact.emailOk.detail',
      points: 0,
    })
  }

  const digits = phoneDigits(data.phone)
  if (data.phone.trim() === '' || digits < MIN_PHONE_DIGITS) {
    issues.push({
      id: 'contact.phone.short',
      ruleId: 'contact.phone',
      severity: 'bad',
      titleId: 'ats.contact.phoneBad.title',
      detailId: 'ats.contact.phoneBad.detail',
      points: 12,
      params: { digits, min: MIN_PHONE_DIGITS },
      target: { ...target, field: 'profile-phone' },
      fixHintId: 'ats.fix.fillField',
    })
  } else {
    issues.push({
      id: 'contact.phone.ok',
      ruleId: 'contact.phone',
      severity: 'ok',
      titleId: 'ats.contact.phoneOk.title',
      detailId: 'ats.contact.phoneOk.detail',
      points: 0,
      params: { digits },
    })
  }

  if (data.location.trim() === '') {
    issues.push({
      id: 'contact.location.missing',
      ruleId: 'contact.location',
      severity: 'warn',
      titleId: 'ats.contact.locationWarn.title',
      detailId: 'ats.contact.locationWarn.detail',
      points: 4,
      target: { ...target, field: 'profile-location' },
      fixHintId: 'ats.fix.fillField',
    })
  } else {
    issues.push({
      id: 'contact.location.ok',
      ruleId: 'contact.location',
      severity: 'ok',
      titleId: 'ats.contact.locationOk.title',
      detailId: 'ats.contact.locationOk.detail',
      points: 0,
    })
  }

  const links = data.links.filter((link) => link.url.trim() !== '')
  if (links.length === 0) {
    issues.push({
      id: 'contact.links.none',
      ruleId: 'contact.links',
      severity: 'info',
      titleId: 'ats.contact.linksInfo.title',
      detailId: 'ats.contact.linksInfo.detail',
      points: 1,
      target: { ...target, field: 'profile-link-url-0' },
      fixHintId: 'ats.fix.fillField',
    })
  } else {
    issues.push({
      id: 'contact.links.ok',
      ruleId: 'contact.links',
      severity: 'ok',
      titleId: 'ats.contact.linksOk.title',
      detailId: 'ats.contact.linksOk.detail',
      points: 0,
      params: { count: links.length },
    })
  }

  return issues
}
