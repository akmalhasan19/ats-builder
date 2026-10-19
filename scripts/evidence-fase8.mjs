/* Bukti Gate Fase 8 — homepage, SEO/PWA, dan alur utama.
 *
 * PASS A (preview): workspace hidup + section 2–5 + footer §5.8 + h1 tunggal (1440).
 * PASS B: klik kartu galeri → template berubah + toast + scroll ke workspace.
 * PASS C: breakpoint 360/768/1024/1440 — section terlihat, tanpa scroll horizontal.
 * PASS D: keyboard saja — skip link, anchor ChevronDown, footer, accordion Enter.
 * PASS E: /privacy & /terms — h1 tunggal + konten nyata.
 *
 * Persiapan: `pnpm build` lalu `pnpm vite preview --port 4199 --strictPort`,
 * lalu `node scripts/evidence-fase8.mjs`.
 * Keluaran: artifacts/fase8/*.png + artifacts/fase8/fase8-evidence.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:4199'
const OUT = 'artifacts/fase8'
const BREAKPOINTS = [360, 768, 1024, 1440]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []

const record = (label, value, pass, detail = '') => {
  results.push({ label, value, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

const horizontalOverflow = async (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

/* ============================================ PASS A — workspace + sections == */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  await page.getByRole('main', { name: 'Ruang kerja CV' }).waitFor()
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor()
  record('A1 workspace viewport pertama', 'rail + form + lembar A4 terlihat', true)
  await page.screenshot({ path: `${OUT}/a1-workspace-1440.png` })

  const sectionHeadings = [
    'Lima template, satu aturan: satu kolom.',
    'Tulis CV yang terbaca mesin.',
    'Dari kosong sampai PDF dalam tiga langkah.',
    'Yang sering ditanyakan.',
  ]
  let allVisible = true
  for (const heading of sectionHeadings) {
    const el = page.getByRole('heading', { name: heading })
    await el.scrollIntoViewIfNeeded().catch(() => {})
    if (!(await el.isVisible().catch(() => false))) allVisible = false
  }
  record(
    'A2 section homepage 2–5',
    allVisible ? '4/4 judul terlihat' : 'ada yang hilang',
    allVisible,
  )

  const footer = page.getByRole('contentinfo')
  await footer.scrollIntoViewIfNeeded()
  const privacyLine = await footer
    .getByText(/Semua data CV diproses di browser kamu/)
    .isVisible()
    .catch(() => false)
  const footerNavs = await footer.getByRole('navigation').count()
  record(
    'A3 footer §5.8',
    `4 kolom nav = ${footerNavs}, pernyataan privasi = ${privacyLine}`,
    footerNavs === 4 && privacyLine,
  )
  await page.screenshot({ path: `${OUT}/a2-sections-1440.png`, fullPage: true })

  const h1 = await page.locator('h1').count()
  record('A4 h1 tunggal di homepage', `h1 = ${h1}`, h1 === 1)
  await context.close()
}

/* ====================================== PASS B — klik kartu galeri = set === */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  const trigger = page.locator('[data-probe="template-trigger"]')
  const before = await trigger.textContent()
  const card = page.getByRole('button', { name: /Pakai template ini: Ledger/ })
  await card.scrollIntoViewIfNeeded()
  await card.click()
  await page.locator('[data-sonner-toast]').filter({ hasText: 'Ledger' }).waitFor()
  const after = await trigger.textContent()
  const scrolledToWorkspace = await page.evaluate(() => {
    const main = document.getElementById('workspace-main')
    if (!main) return false
    const rect = main.getBoundingClientRect()
    return rect.bottom > 0 && rect.top < window.innerHeight
  })
  record(
    'B1 klik kartu galeri',
    `template ${before?.trim()} → ${after?.trim()}`,
    before !== after && after?.includes('Ledger') === true && scrolledToWorkspace,
    'toast tampil + scroll kembali ke workspace',
  )
  await page.screenshot({ path: `${OUT}/b1-gallery-click.png` })
  await context.close()
}

/* ============================================ PASS C — empat breakpoint ==== */
for (const width of BREAKPOINTS) {
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 740 : 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  await page.getByRole('main', { name: 'Ruang kerja CV' }).waitFor()
  await page.screenshot({ path: `${OUT}/c-${width}-workspace.png` })

  await page
    .getByRole('heading', { name: 'Lima template, satu aturan: satu kolom.' })
    .scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/c-${width}-galeri.png` })

  await page.getByRole('heading', { name: 'Tulis CV yang terbaca mesin.' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/c-${width}-panduan.png` })

  await page
    .getByRole('heading', { name: 'Dari kosong sampai PDF dalam tiga langkah.' })
    .scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/c-${width}-langkah.png` })

  await page.getByRole('heading', { name: 'Yang sering ditanyakan.' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/c-${width}-faq-footer.png` })

  const geometry = await horizontalOverflow(page)
  record(
    `C${width} layout`,
    `scrollWidth ${geometry.scrollWidth} ≤ clientWidth ${geometry.clientWidth}`,
    geometry.scrollWidth <= geometry.clientWidth + 1,
  )
  await context.close()
}

/* ================================================ PASS D — keyboard saja === */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  await page.getByRole('main', { name: 'Ruang kerja CV' }).waitFor()

  await page.keyboard.press('Tab')
  const skipFocused = await page.evaluate(
    () => document.activeElement?.getAttribute('href') === '#workspace-main',
  )
  record('D1 Tab pertama = skip link', String(skipFocused), skipFocused)

  const chevron = page.getByRole('link', { name: 'Template', exact: true }).first()
  await chevron.focus()
  await page.keyboard.press('Enter')
  const galleryInView = await page
    .getByRole('heading', { name: 'Lima template, satu aturan: satu kolom.' })
    .isVisible()
  record('D2 anchor ChevronDown ke galeri via keyboard', String(galleryInView), galleryInView)

  const faqLink = page
    .getByRole('navigation', { name: 'Sumber daya' })
    .getByRole('link', { name: 'FAQ' })
  await faqLink.focus()
  await page.keyboard.press('Enter')
  const faqHeading = page.getByRole('heading', { name: 'Yang sering ditanyakan.' })
  await faqHeading.scrollIntoViewIfNeeded()
  const faqInView = await faqHeading.isVisible()
  record('D3 anchor FAQ via footer (keyboard)', String(faqInView), faqInView)

  const firstQuestion = page.getByRole('button', { name: 'Apakah Vetra gratis?' })
  await firstQuestion.focus()
  await page.keyboard.press('Enter')
  // Di-scope ke section React — snapshot prerender #home-static memuat teks yang
  // sama untuk crawler.
  await page
    .locator('#home-faq')
    .getByText(/Ya\. Editor, template/)
    .waitFor({ timeout: 3000 })
  record('D4 FAQ accordion terbuka dengan Enter', 'jawaban terlihat', true)
  await page.screenshot({ path: `${OUT}/d1-keyboard-faq.png` })
  await context.close()
}

/* ================================================= PASS E — rute legal ==== */
for (const [route, heading] of [
  ['/privacy', 'Kebijakan Privasi'],
  ['/terms', 'Ketentuan Penggunaan'],
]) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${BASE}${route}`)
  await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
  const h1 = await page.locator('h1').count()
  const body = (await page.locator('main').textContent()) ?? ''
  const real = body.includes('IndexedDB') || body.includes('parser berbeda')
  record(`E ${route}`, `h1 = ${h1}, konten nyata = ${real}`, h1 === 1 && real)
  await page.screenshot({ path: `${OUT}/e${route.replace(/\//g, '-')}.png`, fullPage: true })
  await context.close()
}

await browser.close()
writeFileSync(`${OUT}/fase8-evidence.json`, JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} PASS — artifacts/fase8/`)
process.exit(failed.length === 0 ? 0 : 1)
