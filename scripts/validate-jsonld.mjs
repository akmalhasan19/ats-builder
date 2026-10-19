/* Gate Fase 8 — validasi struktur JSON-LD SoftwareApplication + FAQPage di
 * dist/index.html sesuai syarat Rich Results Test Google:
 *  - SoftwareApplication: @type, name, applicationCategory, operatingSystem,
 *    offers.price + offers.priceCurrency (price "0" = gratis).
 *  - FAQPage: mainEntity[] tiap item Question dengan name + acceptedAnswer.text
 *    yang tak kosong; tidak ada jawaban berklaim "lolos ATS".
 * Jalankan setelah `pnpm build`: node scripts/validate-jsonld.mjs
 */
import { readFileSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const payloads = [
  ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
].map((m) => JSON.parse(m[1]))

let pass = 0
let fail = 0
const check = (label, ok, detail = '') => {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const app = payloads.find((p) => p['@type'] === 'SoftwareApplication')
check('SoftwareApplication ada di head', Boolean(app))
if (app) {
  check('SoftwareApplication.name', typeof app.name === 'string' && app.name.length > 0, app.name)
  check(
    'SoftwareApplication.applicationCategory',
    typeof app.applicationCategory === 'string' && app.applicationCategory.length > 0,
    app.applicationCategory,
  )
  check(
    'SoftwareApplication.operatingSystem',
    typeof app.operatingSystem === 'string' && app.operatingSystem.length > 0,
    app.operatingSystem,
  )
  check(
    'SoftwareApplication.offers.price = "0"',
    app.offers?.price === '0',
    String(app.offers?.price),
  )
  check(
    'SoftwareApplication.offers.priceCurrency',
    typeof app.offers?.priceCurrency === 'string' && app.offers.priceCurrency.length === 3,
    app.offers?.priceCurrency,
  )
}

const faq = payloads.find((p) => p['@type'] === 'FAQPage')
check('FAQPage ada', Boolean(faq))
if (faq) {
  const entities = faq.mainEntity ?? []
  check('FAQPage.mainEntity ≥ 6 pertanyaan', entities.length >= 6, `${entities.length} pertanyaan`)
  let allNamed = true
  let allAnswered = true
  let noClaims = true
  for (const q of entities) {
    if (q['@type'] !== 'Question' || typeof q.name !== 'string' || q.name.length === 0)
      allNamed = false
    const text = q.acceptedAnswer?.text
    if (q.acceptedAnswer?.['@type'] !== 'Answer' || typeof text !== 'string' || text.length === 0)
      allAnswered = false
    if (typeof text === 'string' && /lolos\s+(ats|seratus)|100%|dijamin/i.test(text))
      noClaims = false
  }
  check('Semua Question punya name', allNamed)
  check('Semua Question punya acceptedAnswer.text', allAnswered)
  check('Tidak ada klaim "lolos ATS"/"100%"/jaminan (P5)', noClaims)
}

console.log(`\n${pass} PASS, ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
