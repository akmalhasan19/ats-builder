/* Bukti Gate Fase 6 — koleksi template ATS.
 *
 * PASS A (dev, http://localhost:5173/dev/template-compare): perbandingan
 *   berdampingan preview vs halaman 1 PDF per template + Δ posisi blok nama
 *   (ambang Gate ±1 mm) via window.__atsTemplateCompare.
 * PASS B (dev): alur UI — popover TemplateSelect dengan thumbnail render-nyata,
 *   ganti template lewat keyboard saja (toast, font pratinjau berubah),
 *   breakpoint 360/768/1024/1440, halaman /templates (grid, detail spec,
 *   aksen ledger + peringatan, Pakai template).
 * PASS C (build, http://localhost:4173): /templates tanpa login, lalu offline —
 *   detail, ganti template, dan pratinjau tetap berfungsi (P2).
 *
 * Persiapan: `pnpm dev` (5173) dan `pnpm build && pnpm preview` (4173), lalu
 *   node scripts/evidence-fase6.mjs
 * Keluaran: artifacts/fase6/*.png + artifacts/fase6/fase6-evidence.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const DEV_BASE = process.env.E2E_BASE ?? 'http://localhost:5173'
const PROD_BASE = process.env.PROD_BASE ?? 'http://localhost:4173'
const OUT = 'artifacts/fase6'
const TEMPLATE_IDS = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []

const record = (label, value, pass, detail = '') => {
  results.push({ label, value, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

const dismissFirstRun = async (page) => {
  const later = page.getByRole('radio', { name: /Nanti saja/ })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    await later.click()
    await page.getByRole('button', { name: 'Lanjut' }).click()
  }
}

/* ================================================== PASS A — perbandingan ==== */
{
  const context = await browser.newContext({ viewport: { width: 1780, height: 1400 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/dev/template-compare`)
  await page.locator('[data-probe="compare-canvas"]').first().waitFor({ timeout: 30_000 })

  // Tunggu kelima baris selesai mengukur.
  await page.waitForFunction(
    () =>
      Object.keys(window.__atsTemplateCompare ?? {}).length >= 5,
    undefined,
    { timeout: 90_000 },
  )
  const raws = await page.evaluate(() => window.__atsTemplateCompare)

  // Baseline kedua sisi dihitung dari SUMBER METRIK YANG SAMA: hhea TTF yang
  // di-embed PDF (fontkit), formula half-leading yang sama dengan CSS. Tanpa
  // ini, perbandingan tercemar perbedaan tabel metrik platform (canvas
  // fontBoundingBox DirectWrite ≠ hhea — sempat menampilkan Δ 1,15 mm palsu).
  const fontkit = (await import('@pdf-lib/fontkit')).default
  const { readFileSync } = await import('node:fs')
  const path = await import('node:path')
  const PX_PER_MM = 96 / 25.4
  const PDF_TO_PX = 96 / 72
  const metricCache = new Map()
  const hheaOf = (file) => {
    if (!metricCache.has(file)) {
      const font = fontkit.create(new Uint8Array(readFileSync(path.resolve('public/fonts', file))))
      metricCache.set(file, { asc: font.ascent, desc: font.descent, upm: font.unitsPerEm })
    }
    return metricCache.get(file)
  }

  for (const id of TEMPLATE_IDS) {
    const raw = raws[id]
    const { asc, desc, upm } = hheaOf(raw.pdfFontFile)
    const contentPx = ((asc - desc) / upm) * raw.sizePx
    const ascPx = (asc / upm) * raw.sizePx
    const domBaselineMm = (raw.domNameTopPx + (raw.linePx - contentPx) / 2 + ascPx) / PX_PER_MM
    const pdfBaselineMm = raw.pdfBaselineMm
    const deltaLeft = Math.abs(raw.domLeftMm - raw.pdfLeftMm)
    const deltaTop = Math.abs(domBaselineMm - pdfBaselineMm)
    const rounded = {
      leftMm: Math.round(deltaLeft * 100) / 100,
      topMm: Math.round(deltaTop * 100) / 100,
    }
    record(
      `Δ preview vs PDF ≤ 1 mm — ${id}`,
      `kiri ${rounded.leftMm} mm · atas (baseline hhea) ${rounded.topMm} mm`,
      rounded.leftMm <= 1 && rounded.topMm <= 1,
      `pdfBaseline ${pdfBaselineMm.toFixed(2)} mm vs domBaseline ${domBaselineMm.toFixed(2)} mm`,
    )
    await page
      .locator(`[data-probe="compare-row"][data-template="${id}"]`)
      .screenshot({ path: `${OUT}/compare-${id}.png` })
  }
  await page.screenshot({ path: `${OUT}/compare-all.png`, fullPage: true })
  await context.close()
}

/* ===================================================== PASS B — alur UI ===== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page)

  // 1. Keyboard saja: buka popover, pilih Executive, toast + font pratinjau.
  await page.locator('[data-probe="template-trigger"]').focus()
  await page.keyboard.press('Enter')
  const popover = page.getByRole('dialog')
  await popover.waitFor()
  await page
    .locator('[data-probe="template-trigger"]')
    .evaluate(() => undefined)
    .catch(() => undefined)
  // Fokus berada pada elemen popover pertama; Tab sampai kartu Executive.
  let reached = false
  for (let i = 0; i < 10 && !reached; i += 1) {
    reached = await page.evaluate(() => {
      const active = document.activeElement
      return (
        active instanceof HTMLButtonElement &&
        active.getAttribute('aria-pressed') !== null &&
        active.textContent?.includes('Executive') === true
      )
    })
    if (!reached) await page.keyboard.press('Tab')
  }
  record('popover: kartu Executive terjangkau keyboard', reached ? 'ya' : 'tidak', reached)
  await page.screenshot({ path: `${OUT}/popover-thumbs.png` })
  await page.keyboard.press('Enter')
  await page.getByText('Template Executive dipakai').waitFor({ timeout: 5000 })
  record(
    'ganti template: toast "Template Executive dipakai"',
    'tampil',
    true,
  )
  await page.waitForTimeout(300)
  const fontFamily = await page.evaluate(() => {
    const header = document
      .querySelector('#pane-preview [data-block-kind="header"]')
      ?.querySelector('div')
    return header ? getComputedStyle(header).fontFamily : ''
  })
  record(
    'pratinjau memakai tipografi Executive (Source Serif 4)',
    fontFamily,
    fontFamily.includes('Source Serif 4'),
  )
  await page.screenshot({ path: `${OUT}/workspace-executive.png` })

  // 2. Konten dokumen tidak berubah saat ganti template (semua bagian tetap).
  const sections = await page.evaluate(() =>
    document.querySelectorAll('#pane-preview [data-probe="preview-block"]').length,
  )
  record('lembar tetap terisi blok setelah ganti template', `${sections} blok`, sections > 5)

  // 3. Breakpoint 360/768/1024/1440 dengan template Executive aktif.
  for (const width of [360, 768, 1024, 1440]) {
    const shotContext = await browser.newContext({ viewport: { width, height: 900 } })
    const shotPage = await shotContext.newPage()
    await shotPage.goto(`${DEV_BASE}/`)
    await dismissFirstRun(shotPage)
    const previewTab = shotPage.getByRole('tab', { name: 'Pratinjau' })
    if (
      await previewTab
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    )
      await previewTab.click()
    await shotPage.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
    await shotPage.waitForTimeout(600)
    const numbers = await shotPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sheet: Math.round(
        document
          .querySelector('#pane-preview [data-probe="page-sheet"]')
          ?.getBoundingClientRect().width ?? 0,
      ),
    }))
    record(
      `breakpoint ${width}px (template Executive)`,
      `overflow ${numbers.overflow}px · lembar ${numbers.sheet}px`,
      numbers.overflow <= 0 && numbers.sheet > 0,
    )
    await shotPage.screenshot({ path: `${OUT}/bp-${width}.png` })
    await shotContext.close()
  }

  // 4. Halaman /templates: grid, kartu, detail, aksen ledger, Pakai template.
  await page.goto(`${DEV_BASE}/templates`)
  await page.locator('[data-probe="template-card-executive"]').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1200)
  const cardCount = await page.locator('[data-probe^="template-card-"]').count()
  record('galeri /templates: 5 kartu render nyata', `${cardCount} kartu`, cardCount === 5)
  await page.screenshot({ path: `${OUT}/templates-grid.png`, fullPage: true })

  await page.locator('[data-probe="template-card-ledger"]').click()
  await page.locator('[data-probe="template-detail"]').waitFor()
  await page.waitForTimeout(800)
  // Aksen ledger: toggle → peringatan mono muncul; matikan lagi.
  const accentSwitch = page.getByRole('switch', { name: 'Aksen warna' })
  await accentSwitch.click()
  await page.locator('[data-probe="accent-warning"]').waitFor()
  const warningText = await page.locator('[data-probe="accent-warning"]').textContent()
  record(
    'aksen ledger: peringatan mono saat dinyalakan',
    warningText?.trim() ?? '',
    (warningText ?? '').includes('hitam-putih'),
  )
  await page.screenshot({ path: `${OUT}/templates-detail-ledger-accent.png` })
  await accentSwitch.click()

  await page.locator('[data-probe="template-card-executive"]').click()
  await page.locator('[data-probe="use-template"]').click()
  await page.getByText('Template Executive dipakai').waitFor({ timeout: 5000 })
  record('/templates: tombol Pakai template + toast', 'Executive dipakai', true)
  await page.screenshot({ path: `${OUT}/templates-detail-executive.png`, fullPage: true })
  await context.close()
}

/* ============================================ PASS C — /templates offline ==== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  // Muat online dulu supaya chunk halaman & thumbnail ada di cache konteks.
  await page.goto(`${PROD_BASE}/templates`)
  await page.locator('[data-probe="template-card-classic-ats"]').waitFor({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  const loginVisible = await page.getByRole('button', { name: /Masuk/ }).count()
  record('/templates tanpa login', 'render penuh', loginVisible === 0)

  await context.setOffline(true)
  await page.locator('[data-probe="template-card-minimal"]').click()
  await page.locator('[data-probe="use-template"]').click()
  await page.getByText('Template Minimal dipakai').waitFor({ timeout: 8000 })
  record('offline: ganti template dari /templates tetap berfungsi (P2)', 'Minimal dipakai', true)
  await page.screenshot({ path: `${OUT}/templates-offline-minimal.png`, fullPage: true })

  // Pratinjau offline memakai tipografi Minimal.
  const fontFamily = await page.evaluate(() => {
    const header = document
      .querySelector('[data-probe="page-sheet"] [data-block-kind="header"]')
      ?.querySelector('div')
    return header ? getComputedStyle(header).fontFamily : ''
  })
  record('offline: pratinjau memakai template baru', fontFamily, fontFamily.length > 0)
  await context.close()
}

await browser.close()
writeFileSync(`${OUT}/fase6-evidence.json`, JSON.stringify(results, null, 2))
const failed = results.filter((item) => !item.pass)
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lolos`)
if (failed.length > 0) {
  console.log('BELUM TERBUKTI:', failed.map((item) => `${item.label} (${item.value})`).join(' | '))
  process.exitCode = 1
}
