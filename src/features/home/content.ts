import type { TranslationKey } from '@/dictionaries/id'

export type HomeFaq = { qKey: TranslationKey; aKey: TranslationKey }

export const HOME_FAQS: HomeFaq[] = [
  { qKey: 'home.faq.1.q', aKey: 'home.faq.1.a' },
  { qKey: 'home.faq.2.q', aKey: 'home.faq.2.a' },
  { qKey: 'home.faq.3.q', aKey: 'home.faq.3.a' },
  { qKey: 'home.faq.4.q', aKey: 'home.faq.4.a' },
  { qKey: 'home.faq.5.q', aKey: 'home.faq.5.a' },
  { qKey: 'home.faq.6.q', aKey: 'home.faq.6.a' },
  { qKey: 'home.faq.7.q', aKey: 'home.faq.7.a' },
  { qKey: 'home.faq.8.q', aKey: 'home.faq.8.a' },
]

export type HomeGuideRule = { titleKey: TranslationKey; bodyKey: TranslationKey }

export const HOME_GUIDE_RULES: HomeGuideRule[] = [
  { titleKey: 'home.guide.ruleOneColumn.title', bodyKey: 'home.guide.ruleOneColumn.body' },
  { titleKey: 'home.guide.ruleFonts.title', bodyKey: 'home.guide.ruleFonts.body' },
  { titleKey: 'home.guide.ruleHeadings.title', bodyKey: 'home.guide.ruleHeadings.body' },
  { titleKey: 'home.guide.ruleBullets.title', bodyKey: 'home.guide.ruleBullets.body' },
  { titleKey: 'home.guide.ruleDates.title', bodyKey: 'home.guide.ruleDates.body' },
  { titleKey: 'home.guide.ruleContact.title', bodyKey: 'home.guide.ruleContact.body' },
  { titleKey: 'home.guide.ruleNoPhoto.title', bodyKey: 'home.guide.ruleNoPhoto.body' },
  { titleKey: 'home.guide.ruleLength.title', bodyKey: 'home.guide.ruleLength.body' },
]
