/* Bukti Gate C5 — mobile, performa, a11y, dan sapuan QA (FASE 12).
 *
 * PASS A — bundle awal (metode yang sama dengan `evidence-fase9.mjs`, supaya
 *   angkanya bisa dibandingkan langsung dengan baseline Fase 9: 279,01 KB gzip).
 * PASS B — React Profiler (dev): mengetik di form vs mengetik di kanvas vs
 *   commit kanvas — jumlah blok yang dirender ulang & durasinya.
 * PASS C — sapuan QA lintas template × mode: segmen/ghost hanya ada di mode
 *   kanvas, screenshot per template per mode ke artifacts/evidence/.
 * PASS D — PDF hasil unduhan dari mode kanvas: isi dokumen ada, teks guide &
 *   ghost tidak pernah ikut (D5/D12).
 *
 * Persiapan:
 *   pnpm build
 *   pnpm dev --port 5173 --strictPort
 * Jalankan: node scripts/evidence-fase12-c5.mjs
 * Keluaran: artifacts/evidence/c5-*.png + artifacts/evidence/fase12-c5.json
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { chromium } from '@playwright/test'

const DEV_BASE = process.env.E2E_BASE ?? 'http://localhost:5173'
const OUT = 'artifacts/evidence'
const BASELINE_BUNDLE_KB = 279.01 // Execution Log Fase 9 (2026-10-19)
const TEMPLATE_IDS = ['classic-ats', 'ledger', 'executive', 'minimal', 'technician']
const TEMPLATE_NAMES = {
  'classic-ats': 'Classic ATS',
  ledger: 'Ledger',
  executive: 'Executive',
  minimal: 'Minimal',
  technician: 'Technician',
}

/** Teks yang hanya boleh ada di layar (D5/D12). */
const GUIDE_TEXTS = [
  'Nama lengkap',
  'Role yang kamu lamar',
  'Nomor telepon',
  'Ringkasan profesional',
  'Nama kelompok skill',
  'Skill 1, Skill 2',
  'Bulan mulai',
  'Satu bullet: aksi',
  'Tambahkan entri',
  'Tambahkan bullet',
  'Tambahkan bagian',
]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []
const record = (label, value, pass, detail = '') => {
  results.push({ label, value, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

/* ============================ PASS A — bundle awal ======================== */
{
  const html = readFileSync(path.resolve('dist', 'index.html'), 'utf8')
  const eager = new Set()
  for (const match of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)) eager.add(match[1])
  let total = 0
  const rows = []
  for (const rel of eager) {
    const gz = gzipSync(readFileSync(path.resolve('dist', rel.slice(1)))).length
    total += gz
    rows.push(`${rel} ${(gz / 1024).toFixed(2)}`)
  }
  total += gzipSync(Buffer.from(html)).length
  const kb = total / 1024
  const delta = kb - BASELINE_BUNDLE_KB
  record(
    'bundle awal (gzip)',
    `${kb.toFixed(2)} KB`,
    // Bukan budget keras (keputusan owner Fase 9 no. 1): pertumbuhan dicatat
    // apa adanya, gagal hanya kalau melewati +10% dari baseline Fase 9.
    delta <= BASELINE_BUNDLE_KB * 0.1,
    `Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} KB vs Fase 9 (${BASELINE_BUNDLE_KB} KB) · ${rows.join(' | ')}`,
  )

  // Editor kanvas bukan chunk terpisah: diuji dengan lazy split, hasilnya
  // +0,64 KB gzip lebih berat (chunk bersama zod/store), jadi tidak dipakai.
  const assets = readdirSync(path.resolve('dist/assets'))
  record(
    'tidak ada chunk editor terpisah (lazy split ditolak, terukur)',
    `${assets.filter((name) => name.endsWith('.js')).length} chunk JS`,
    !assets.some((name) => /^Canvas(Field|Dates)Editor-/.test(name)),
    'lazy split diukur: 291,53 vs 290,89 KB gzip (lebih berat) — lihat Execution Log C5.3',
  )
}

const dismissFirstRun = async (page, choice = 'contoh') => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', {
      name: choice === 'kosong' ? /Mulai dari kosong/ : /Nanti saja/,
    })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
    await page.getByRole('button', { name: 'Lanjut' }).waitFor({ state: 'hidden', timeout: 5000 })
  }
}

const toCanvasMode = async (page) => {
  await page.locator('[data-probe="tampilan-menu"]').click()
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  const mode = await page.locator('[data-edit-mode]').getAttribute('data-edit-mode')
  if (mode !== 'canvas') throw new Error(`mode tidak berganti: ${mode}`)
  await page.keyboard.press('Escape')
}

const toFormMode = async (page) => {
  await page.locator('[data-probe="tampilan-menu"]').click()
  await page.locator('[data-probe="edit-mode-form"]').click()
  await page.keyboard.press('Escape')
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

/* ===================== PASS B — Profiler form vs kanvas =================== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page)

  const readProbe = () =>
    page.evaluate(() => {
      const items = window.__atsPreviewRenders ?? []
      const durations = items.map((item) => item.duration)
      return {
        renders: items.length,
        blocks: [...new Set(items.map((item) => item.id))],
        totalMs: Math.round(durations.reduce((acc, value) => acc + value, 0) * 100) / 100,
        maxMs: durations.length ? Math.max(...durations) : 0,
      }
    })
  const resetProbe = () => page.evaluate(() => (window.__atsPreviewRenders = []))

  // (1) form terpandu: setiap ketikan menulis store → blok ringkasan dirender ulang.
  await page
    .locator('aside[aria-label="Bagian"] nav')
    .getByRole('button')
    .filter({ hasText: 'Ringkasan' })
    .first()
    .click()
  const summary = page.locator('#summary-text')
  await summary.click()
  await summary.press('End')
  await resetProbe()
  await summary.pressSequentially('abcdefghij')
  await page.waitForTimeout(250)
  const form = await readProbe()

  // (2) kanvas: draft hidup di komponen editor, store tidak disentuh per ketikan.
  await toCanvasMode(page)
  await page.locator('#pane-preview [data-field="summary.text"]').click()
  const editor = page.locator('#pane-preview .canvas-editor')
  await editor.waitFor({ state: 'visible', timeout: 10_000 })
  await editor.press('End')
  await resetProbe()
  await editor.pressSequentially('abcdefghij')
  await page.waitForTimeout(250)
  const canvasTyping = await readProbe()

  // (3) commit kanvas: satu tulisan store, satu blok.
  await resetProbe()
  await editor.press('Control+Enter')
  await page.waitForTimeout(300)
  const canvasCommit = await readProbe()

  record(
    'Profiler: ketikan form (10 karakter)',
    `${form.renders} render · ${form.totalMs} ms · ${form.blocks.length} blok`,
    form.renders > 0,
  )
  record(
    'Profiler: ketikan kanvas (10 karakter)',
    `${canvasTyping.renders} render · ${canvasTyping.totalMs} ms · ${canvasTyping.blocks.length} blok`,
    // `preview-tree` adalah Profiler akar yang selalu ikut; yang dihitung adalah
    // blok dokumen. Kanvas hanya boleh menyentuh blok yang sedang diedit, dan
    // durasinya harus di bawah form (draft tidak menulis store per ketikan).
    canvasTyping.blocks.filter((id) => id !== 'preview-tree').length <= 1 &&
      canvasTyping.totalMs <= form.totalMs,
    `blok: ${canvasTyping.blocks.filter((id) => id !== 'preview-tree').join(', ') || '-'} · form ${form.renders} render/${form.blocks.length} blok`,
  )
  record(
    'Profiler: commit kanvas',
    `${canvasCommit.renders} render · ${canvasCommit.totalMs} ms · maks ${canvasCommit.maxMs} ms`,
    canvasCommit.renders >= 1,
  )

  await context.close()
}

/* ================= PASS C — sapuan QA lintas template × mode ============== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page)

  for (const id of TEMPLATE_IDS) {
    await applyTemplate(page, id)

    // Mode form: nol affordance kanvas (Gate C2/C5).
    await toFormMode(page)
    await page.waitForTimeout(300)
    const formFields = await page.locator('#pane-preview [data-canvas-field]').count()
    const formGhosts = await page.locator('#pane-preview [data-canvas-ghost]').count()
    record(
      `mode form — ${id}: nol segmen & ghost`,
      `${formFields}/${formGhosts}`,
      formFields === 0 && formGhosts === 0,
    )
    await page
      .locator('#pane-preview [data-probe="page-sheet"]')
      .first()
      .screenshot({ path: `${OUT}/c5-${id}-form.png` })

    // Mode kanvas: segmen & ghost hidup.
    await toCanvasMode(page)
    await page.waitForTimeout(400)
    const fields = await page.locator('#pane-preview [data-canvas-field]').count()
    const ghosts = await page.locator('#pane-preview [data-canvas-ghost]').count()
    record(
      `mode kanvas — ${id}: segmen & ghost tersedia`,
      `${fields}/${ghosts}`,
      fields > 0 && ghosts > 0,
    )
    await page
      .locator('#pane-preview [data-probe="page-sheet"]')
      .first()
      .screenshot({ path: `${OUT}/c5-${id}-canvas.png` })
  }
  await context.close()
}

/* ======================= PASS D — PDF dari mode kanvas =================== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page)
  await toCanvasMode(page)

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.locator('[data-probe="download-pdf"]:visible').last().click(),
  ])
  const bytes = readFileSync(await download.path())
  writeFileSync(path.join(OUT, 'c5-canvas-export.pdf'), bytes)

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
    'PDF mode kanvas bebas teks guide & ghost',
    leaked.length === 0 ? 'bersih' : leaked.join(', '),
    leaked.length === 0,
  )
  record('PDF memuat isi dokumen', 'Alex Morgan', text.includes('Alex Morgan'))
  record('halaman PDF', `${pdf.numPages} halaman`, pdf.numPages >= 1)

  // Mobile: kanvas tetap usable di Pixel 7 (C5.1) — satu screenshot bukti.
  const mobile = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  })
  const mobilePage = await mobile.newPage()
  await mobilePage.goto(`${DEV_BASE}/`)
  await dismissFirstRun(mobilePage)
  // Di mobile kertas hidup di tab Pratinjau (tab default = Isi data).
  await mobilePage.getByRole('tab', { name: /Pratinjau/ }).click()
  await mobilePage
    .locator('#pane-preview [data-probe="page-sheet"]')
    .first()
    .waitFor({ timeout: 20_000 })
  await mobilePage.getByRole('button', { name: 'Menu' }).click()
  await mobilePage.locator('[data-probe="edit-mode-canvas"]').click()
  await mobilePage.keyboard.press('Escape')
  await mobilePage.waitForTimeout(500)
  const mobileFields = await mobilePage.locator('#pane-preview [data-canvas-field]').count()
  record('kanvas mobile (Pixel 7): segmen tersedia', `${mobileFields} segmen`, mobileFields > 0)
  await mobilePage.screenshot({ path: `${OUT}/c5-mobile-canvas.png`, fullPage: false })
  await mobile.close()

  writeFileSync(
    path.join(OUT, 'fase12-c5.json'),
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
