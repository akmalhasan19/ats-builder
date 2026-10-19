import { id } from '@/dictionaries/id'
import { HOME_FAQS } from './content'

export function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map((faq) => ({
      '@type': 'Question',
      name: id[faq.qKey],
      acceptedAnswer: { '@type': 'Answer', text: id[faq.aKey] },
    })),
  }
}
