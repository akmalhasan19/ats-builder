/**
 * T8.7 (Opsi B) — prerender ringan tanpa SSR framework: setelah `vite build`,
 * bangun snapshot HTML homepage statis (section 2–6 + JSON-LD FAQ) langsung
 * dari kamus `id` + daftar template, lalu suntik ke `dist/index.html` untuk
 * crawler. Tanpa ReactDOMServer: teks snapshot ditulis dari sumber data yang
 * sama dengan komponen React (tanpa duplikasi string), dan tautan/heading
 * mengikuti struktur `HomeSections`. Workspace tetap client-only: snapshot
 * dibungkus `<div id="home-static">` yang disembunyikan setelah React hydrate.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const dictSrc = readFileSync('src/dictionaries/id.ts', 'utf8')
const dict = {}
const entryRe = /'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g
let m
while ((m = entryRe.exec(dictSrc)) !== null) {
  const raw = m[2] ?? m[3] ?? ''
  dict[m[1]] = raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'")
}

const t = (key) => {
  const v = dict[key]
  if (typeof v !== 'string' || v.length === 0)
    throw new Error(`prerender: kunci kamus hilang: ${key}`)
  return v
}

const TEMPLATES = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']
const FAQS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
  q: t(`home.faq.${n}.q`),
  a: t(`home.faq.${n}.a`),
}))
const RULES = [
  'ruleOneColumn',
  'ruleFonts',
  'ruleHeadings',
  'ruleBullets',
  'ruleDates',
  'ruleContact',
  'ruleNoPhoto',
  'ruleLength',
].map((r) => ({ title: t(`home.guide.${r}.title`), body: t(`home.guide.${r}.body`) }))
const STEPS = [1, 2, 3].map((n) => ({
  title: t(`home.step.${n}.title`),
  body: t(`home.step.${n}.body`),
}))

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const footerCol = (titleKey, items) =>
  `<section aria-label="${esc(t(titleKey))}"><h3>${esc(t(titleKey))}</h3><ul>${items
    .map(([labelKey, href]) => `<li><a href="${esc(href)}">${esc(t(labelKey))}</a></li>`)
    .join('')}</ul></section>`

const html = [
  '<section aria-labelledby="static-home-templates-title">',
  `<p>${esc(t('home.section.templates.eyebrow'))}</p>`,
  `<h2 id="static-home-templates-title">${esc(t('home.section.templates.title'))}</h2>`,
  `<p>${esc(t('home.section.templates.body'))}</p>`,
  '<ul>' +
    TEMPLATES.map(
      (id) =>
        `<li><h3>${esc(t(`template.${id}`))}</h3><p>${esc(t(`template.desc.${id}`))}</p></li>`,
    ).join('') +
    '</ul>',
  `<p><a href="/templates">${esc(t('home.section.templates.viewAll'))}</a></p>`,
  '</section>',
  '<section aria-labelledby="static-home-guide-title">',
  `<p>${esc(t('home.section.guide.eyebrow'))}</p>`,
  `<h2 id="static-home-guide-title">${esc(t('home.section.guide.title'))}</h2>`,
  `<p>${esc(t('home.section.guide.body'))}</p>`,
  '<ol>' +
    RULES.map((r) => `<li><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p></li>`).join('') +
    '</ol>',
  '</section>',
  '<section aria-labelledby="static-home-steps-title">',
  `<p>${esc(t('home.section.steps.eyebrow'))}</p>`,
  `<h2 id="static-home-steps-title">${esc(t('home.section.steps.title'))}</h2>`,
  '<ol>' +
    STEPS.map((s) => `<li><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></li>`).join('') +
    '</ol>',
  '</section>',
  '<section aria-labelledby="static-home-faq-title">',
  `<p>${esc(t('home.section.faq.eyebrow'))}</p>`,
  `<h2 id="static-home-faq-title">${esc(t('home.section.faq.title'))}</h2>`,
  '<dl>' +
    FAQS.map((f) => `<div><dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd></div>`).join('') +
    '</dl>',
  '</section>',
  '<footer>',
  footerCol('home.footer.product', [
    ['home.footer.templates', '/templates'],
    ['home.footer.backToEditor', '#home-templates'],
  ]),
  footerCol(
    'home.footer.templates',
    TEMPLATES.map((id) => [`template.${id}`, '/templates']),
  ),
  footerCol('home.footer.resources', [
    ['home.footer.guide', '#home-guide'],
    ['home.footer.howTo', '#home-steps'],
    ['home.footer.faqShort', '#home-faq'],
  ]),
  footerCol('home.footer.legal', [
    ['home.footer.privacy', '/privacy'],
    ['home.footer.terms', '/terms'],
  ]),
  `<p>${esc(t('home.footer.rights'))}</p>`,
  `<p>${esc(t('home.footer.privacyLine'))}</p>`,
  '</footer>',
].join('')

const faqJson = JSON.stringify(faqJsonLd)

// Chunk HomeSections dimuat lewat dynamic import — tanpa modulepreload ia
// baru ditemukan setelah eksekusi entry (satu RTT ekstra di 4G), menunda teks
// galeri yang menjadi kandidat LCP. Nama berkas ber-hash dibaca dari dist.
import { readdirSync } from 'node:fs'
const homeChunk = readdirSync('dist/assets').find(
  (f) => f.startsWith('HomeSections-') && f.endsWith('.js'),
)
const preloadTag = homeChunk ? `    <link rel="modulepreload" href="/assets/${homeChunk}" />\n` : ''

const indexPath = 'dist/index.html'
let index = readFileSync(indexPath, 'utf8')
if (!index.includes('id="home-static"')) {
  index = index
    .replace(
      '<div id="root"></div>',
      `<div id="root"></div>\n    <div id="home-static" aria-hidden="true">${html}</div>`,
    )
    .replace(
      '</head>',
      `${preloadTag}    <style>#home-static{position:absolute;top:0;left:0;width:100%;z-index:-1;opacity:0;pointer-events:none}#root:not(:empty)+#home-static{display:none}</style>\n  </head>`,
    )
    .replace(
      '</head>',
      `    <script type="application/ld+json" data-faq-static>${faqJson}</script>\n  </head>`,
    )
  writeFileSync(indexPath, index)
}
console.log(
  `prerender: snapshot homepage ${html.length} char + FAQ ${FAQS.length} Q disuntik ke dist/index.html${homeChunk ? ` + modulepreload ${homeChunk}` : ''}`,
)
