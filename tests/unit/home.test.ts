import { describe, expect, it } from 'vitest'
import { HOME_FAQS, HOME_GUIDE_RULES } from '@/features/home/content'
import { buildFaqJsonLd } from '@/features/home/faqJsonLd'
import { id } from '@/dictionaries/id'

describe('konten homepage Fase 8', () => {
  it('punya 8 aturan panduan dan 8 FAQ tanpa kata lorem', () => {
    expect(HOME_GUIDE_RULES).toHaveLength(8)
    expect(HOME_FAQS).toHaveLength(8)
    const texts = [
      ...HOME_GUIDE_RULES.flatMap((r) => [id[r.titleKey], id[r.bodyKey]]),
      ...HOME_FAQS.flatMap((f) => [id[f.qKey], id[f.aKey]]),
    ]
    for (const text of texts) {
      expect(text.length).toBeGreaterThan(0)
      expect(text.toLowerCase()).not.toContain('lorem')
    }
  })

  it('JSON-LD FAQ valid: 8 Question dengan Answer terisi', () => {
    const jsonLd = buildFaqJsonLd()
    expect(jsonLd['@type']).toBe('FAQPage')
    expect(jsonLd.mainEntity).toHaveLength(8)
    for (const entity of jsonLd.mainEntity) {
      expect(entity['@type']).toBe('Question')
      expect(entity.name.length).toBeGreaterThan(0)
      expect(entity.acceptedAnswer.text.length).toBeGreaterThan(0)
      expect(entity.acceptedAnswer.text.toLowerCase()).not.toContain('lolos ats')
    }
  })

  it('tidak menjanjikan lolos ATS di mana pun', () => {
    const banned = ['lolos ats', '100%']
    const texts = HOME_FAQS.flatMap((f) => [id[f.qKey], id[f.aKey]])
    for (const text of texts) {
      for (const phrase of banned) {
        expect(text.toLowerCase()).not.toContain(phrase)
      }
    }
  })
})
