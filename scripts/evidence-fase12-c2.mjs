/* Bukti Gate C2 — guide placeholder di atas kertas (FASE 12).
 *
 * PASS A (dev, /dev/template-compare): Δ posisi blok nama preview vs PDF untuk
 *   kelima template, dalam mode "Langsung di CV" AKTIF. Halaman pembanding
 *   memakai jalur form (scope), jadi guide tidak boleh menggeser geometri.
 * PASS B (dev, /): kerangka guide pada dokumen kosong & dokumen contoh,
 *   lima template → artifacts/evidence/.
 * PASS C (dev, /): berkas PDF yang diunduh dalam mode kanvas tidak memuat
 *   satu pun teks guide (D12), dan jumlah halamannya tetap milik isi dokumen.
 *
 * Persiapan: `pnpm dev --port 5173` lalu
 *   node scripts/evidence-fase12-c2.mjs
 * Keluaran: artifacts/evidence/c2-*.png + artifacts/evidence/fase12-c2.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const DEV_BASE = process.env.E2E_BASE ?? 'http://localhost:5173'
const OUT = 'artifacts/evidence'
const TEMPLATE_IDS = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']
const TEMPLATE_NAMES = {
  'classic-ats': 'Classic ATS',
  ledger: 'Ledger',
  executive: 'Executive',
  minimal: 'Minimal',
  technician: 'Technician',
}

/** Teks guide yang tidak boleh bocor ke PDF (D5/D12). */
const GUIDE_TEXTS = [
  'Nama lengkap',
  'Role yang kamu lamar',
  'Nomor telepon',
  'Ringkasan profesional',
  'Nama kelompok skill',
  'Skill 1, Skill 2',
  'Bulan mulai',
  'Satu bullet: aksi',
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []

const record = (label, value, pass, detail = '') => {
  results.push({ label, value, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

const dismissFirstRun = async (page, choice = 'kosong') => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    if (choice === 'kosong') await page.getByRole('radio', { name: /Mulai dari kosong/ }).click()
    else await page.getByRole('radio', { name: /Nanti saja/ }).click()
    await later.click()
    await page.getByRole('button', { name: 'Lanjut' }).waitFor({ state: 'hidden', timeout: 5000 })
  }
}

const toCanvasMode = async (page) => {
  await page.locator('[data-probe="tampilan-menu"]').click()
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await page.locator('[data-edit-mode]').waitFor({ state: 'attached' })
  const mode = await page.locator('[data-edit-mode]').getAttribute('data-edit-mode')
  if (mode !== 'canvas') throw new Error(`mode tidak berganti: ${mode}`)
}

const applyTemplate = async (page, id) => {
  await page.locator('[data-probe="template-trigger"]').click()
  const option = page
    .locator('[data-radix-popper-content-wrapper] button')
    .filter({ hasText: TEMPLATE_NAMES[id] })
    .first()
  await option.waitFor({ state: 'visible' })
  await option.click()
  await page
    .locator('[data-probe="template-trigger"]')
    .filter({ hasText: TEMPLATE_NAMES[id] })
    .waitFor()
}

/* ============================== PASS A — Δ preview vs PDF (mode kanvas) ==== */
{
  const context = await browser.newContext({ viewport: { width: 1780, height: 1400 } })
  const page = await context.newPage()

  // Nyalakan mode kanvas lebih dulu supaya mode yang benar-benar diuji.
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page, 'contoh')
  await toCanvasMode(page)

  await page.goto(`${DEV_BASE}/dev/template-compare`)
  await page.locator('[data-probe="compare-canvas"]').first().waitFor({ timeout: 30_000 })
  await page.waitForFunction(
    () => Object.keys(window.__atsTemplateCompare ?? {}).length >= 5,
    undefined,
    { timeout: 90_000 },
  )
  const raws = await page.evaluate(() => window.__atsTemplateCompare)

  // Baseline kedua sisi dari SUMBER METRIK YANG SAMA (hhea TTF) — sama seperti
  // bukti Fase 6, supaya Δ tidak tercemar perbedaan tabel metrik platform.
  const fontkit = (await import('@pdf-lib/fontkit')).default
  const PX_PER_MM = 96 / 25.4
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
    const deltaLeft = Math.abs(raw.domLeftMm - raw.pdfLeftMm)
    const deltaTop = Math.abs(domBaselineMm - raw.pdfBaselineMm)
    const leftMm = Math.round(deltaLeft * 100) / 100
    const topMm = Math.round(deltaTop * 100) / 100
    record(
      `Δ preview vs PDF ≤ 1 mm (mode kanvas) — ${id}`,
      `kiri ${leftMm} mm · atas ${topMm} mm`,
      leftMm <= 1 && topMm <= 1,
    )
    await page
      .locator(`[data-probe="compare-row"][data-template="${id}"]`)
      .screenshot({ path: `${OUT}/c2-compare-${id}.png` })
  }
  await context.close()
}

/* ================================ PASS B — kerangka guide per template ====== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page, 'kosong')
  await toCanvasMode(page)

  for (const id of TEMPLATE_IDS) {
    await applyTemplate(page, id)
    await page.waitForTimeout(500)
    const guides = await page.locator('#pane-preview [data-canvas-guide="true"]').count()
    record(`guide tampil di template ${id}`, `${guides} segmen`, guides > 0)
    await page
      .locator('#pane-preview [data-probe="page-sheet"]')
      .first()
      .screenshot({ path: `${OUT}/c2-canvas-kosong-${id}.png` })
  }
  await context.close()
}

/* ============================ PASS C — PDF tidak memuat teks guide ======== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page, 'kosong')
  await toCanvasMode(page)

  const guideCount = await page.locator('#pane-preview [data-canvas-guide="true"]').count()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('[data-probe="download-pdf"]:visible').last().click(),
  ])
  const file = await download.path()
  const bytes = readFileSync(file)
  writeFileSync(path.join(OUT, 'c2-canvas-export.pdf'), bytes)

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes).slice() }).promise
  let text = ''
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const pdfPage = await pdf.getPage(index)
    const content = await pdfPage.getTextContent()
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
    await pdfPage.cleanup()
  }
  const leaked = GUIDE_TEXTS.filter((guide) => text.includes(guide))
  record(
    'PDF mode kanvas bebas teks guide',
    leaked.length === 0 ? 'bersih' : leaked.join(', '),
    leaked.length === 0,
  )
  record('kerangka guide tampil sebelum ekspor', `${guideCount} segmen`, guideCount > 0)
  record('halaman PDF (dokumen kosong)', `${pdf.numPages} halaman`, pdf.numPages >= 1)

  writeFileSync(
    path.join(OUT, 'fase12-c2.json'),
    JSON.stringify({ results, pdfText: text.trim().slice(0, 4000) }, null, 2),
  )
  await context.close()
}

await browser.close()

const failed = results.filter((item) => !item.pass)
console.log('------------------------------------------------------------------------------')
console.log(`hasil: ${results.length - failed.length}/${results.length} pemeriksaan lolos`)
if (failed.length > 0) {
  console.log('gagal:', failed.map((item) => item.label).join(' | '))
  process.exitCode = 1
}
