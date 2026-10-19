import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Eyebrow } from '@/components/ui/eyebrow'
import { t } from '@/lib/i18n'
import { HOME_FAQS } from './content'

export function Faq() {
  return (
    <section aria-labelledby="home-faq-title" className="bg-sunken px-6 py-16 md:py-20">
      <div className="mx-auto max-w-[760px]">
        <Eyebrow>{t('home.section.faq.eyebrow')}</Eyebrow>
        <h2 id="home-faq-title" className="display-md text-ink mt-2">
          {t('home.section.faq.title')}
        </h2>
        <Accordion
          type="single"
          collapsible
          className="bg-raised border-rule mt-8 rounded-lg border px-5"
        >
          {HOME_FAQS.map((faq, index) => (
            <AccordionItem key={faq.qKey} value={`faq-${index}`}>
              <AccordionTrigger>{t(faq.qKey)}</AccordionTrigger>
              <AccordionContent>
                <p className="text-body text-ink-secondary max-w-[62ch]">{t(faq.aKey)}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
