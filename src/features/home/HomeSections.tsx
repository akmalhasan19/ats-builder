import { buildFaqJsonLd } from './faqJsonLd'
import { TemplateGallery } from './TemplateGallery'
import { AtsGuide } from './AtsGuide'
import { HowItWorks } from './HowItWorks'
import { Faq } from './Faq'
import { SiteFooter } from './SiteFooter'

/**
 * T8.1 — section 2–6 homepage (§5.8). Tiap section memakai `content-visibility:
 * auto` supaya yang di luar viewport tidak ikut membebani layout/paint
 * (LCP/INP), dan urutannya mengikuti plan.md §3C.
 */
export function HomeSections() {
  return (
    <div className="border-rule border-t">
      <div id="home-templates" className="section-defer scroll-mt-20">
        <TemplateGallery />
      </div>
      <div id="home-guide" className="section-defer scroll-mt-20">
        <AtsGuide />
      </div>
      <div id="home-steps" className="section-defer scroll-mt-20">
        <HowItWorks />
      </div>
      <div id="home-faq" className="section-defer scroll-mt-20">
        <Faq />
      </div>
      <script type="application/ld+json">{JSON.stringify(buildFaqJsonLd())}</script>
      <SiteFooter />
    </div>
  )
}
