/* Bukti Gate C4 — entri, tanggal, bullet & ghost row di atas kertas (FASE 12).
 *
 * PASS A: untuk SETIAP template, dari dokumen kosong, CV bagian pengalaman
 *   disusun wholly di kanvas — ghost row "+ Tambahkan entri" → role → company →
 *   popover tanggal → ghost row "+ Tambahkan bullet". Nilai harus tampil di
 *   kertas (pemandu slotnya hilang) dan tiap lembar tetap memuat ghost rownya.
 *   Tangkapan layar → artifacts/evidence/.
 * PASS B: CV hasil susun kanvas diunduh jadi PDF — isi yang diketik ada di
 *   berkas, sedangkan teks ghost row & pemandu tidak (D5/D12).
 *
 * Persiapan: `pnpm dev --port 5173` lalu
 *   node scripts/evidence-fase12-c4.mjs
 * Keluaran: artifacts/evidence/c4-*.png + artifacts/evidence/fase12-c4.json
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

/** Teks affordance kanvas yang tidak boleh bocor ke PDF (D5/D12). */
const CANVAS_ONLY_TEXTS = [
  '+ Tambahkan entri',
  '+ Tambahkan bullet',
  '+ Tambahkan bagian',
  'Satu bullet: aksi + dampak',
  'Bulan mulai – selesai',
  'Nama lengkap',
]

const ROLE = 'Frontend Engineer'
const COMPANY = 'Kirana Digital'
const BULLET = 'Membangun design system yang dipakai 6 tim produk.'

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []

const record = (label, value, pass, detail = '') => {
  results.push({ label, value, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

/** Halaman baru dengan penyimpanan bersih + mode "Langsung di CV" aktif. */
const openCanvasEmpty = async (page) => {
  await page.goto(`${DEV_BASE}/`)
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await page.getByRole('radio', { name: /Mulai dari kosong/ }).click()
  await page.getByRole('button', { name: 'Lanjut' }).click()
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
  await page.waitForTimeout(400)
}

const typeSegment = async (page, selector, value, commit = 'Enter') => {
  await page.locator(selector).first().click()
  const control = page.locator('#pane-preview .canvas-editor')
  await control.waitFor({ state: 'visible' })
  await control.fill(value)
  await control.press(commit)
  await control.waitFor({ state: 'hidden' })
}

/** Ghost row → sesi field pertama; ketik tanpa klik segmen lagi. */
const typeOpenSession = async (page, value) => {
  const control = page.locator('#pane-preview .canvas-editor')
  await control.waitFor({ state: 'visible' })
  await control.fill(value)
  await control.press('Enter')
  await control.waitFor({ state: 'hidden' })
}

const fillDates = async (page, start, end) => {
  await page.locator('#pane-preview [data-field$=".dates"]').first().click()
  const popover = page.locator('[data-probe="canvas-dates"]')
  await popover.waitFor({ state: 'visible' })
  const months = popover.locator('input[type="month"]')
  await months.nth(0).fill(start)
  await months.nth(1).fill(end)
  await popover.getByRole('button', { name: 'Simpan' }).click()
  await popover.waitFor({ state: 'hidden' })
}

/** Susun satu entri pengalaman lengkap langsung di kertas. */
const authorExperienceEntry = async (page) => {
  await page.locator('#pane-preview [data-canvas-ghost="entry"]').first().click()
  await typeOpenSession(page, ROLE)
  await typeSegment(page, '#pane-preview [data-field$=".company"]', COMPANY)
  await fillDates(page, '2021-03', '2024-05')
  await page.locator('#pane-preview [data-canvas-ghost="bullet"]').first().click()
  await typeOpenSession(page, BULLET)
}

const paperHas = (page, text) =>
  page.locator('#pane-preview').getByText(text, { exact: false }).first().isVisible()

/* ==================== PASS A — susun entri di kanvas, lima template ========= */
for (const id of TEMPLATE_IDS) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  try {
    await openCanvasEmpty(page)
    await applyTemplate(page, id)

    const ghostsBefore = await page.locator('#pane-preview [data-canvas-ghost]').count()
    await authorExperienceEntry(page)

    const roleVisible = await paperHas(page, ROLE)
    const companyVisible = await paperHas(page, COMPANY)
    const bulletVisible = await paperHas(page, BULLET)
    const datesVisible = await paperHas(page, 'Mar 2021')
    const stillOnPaper = await paperHas(page, BULLET)
    const guideLeft = await page
      .locator('#pane-preview [data-field$=".company"][data-canvas-guide="true"]')
      .count()
    const ghostsAfter = await page.locator('#pane-preview [data-canvas-ghost]').count()

    record(`entri dibuat dari ghost row — ${id}`, `role ${roleVisible}`, roleVisible)
    record(
      `kepala + tanggal + bullet tampil di kertas — ${id}`,
      `company ${companyVisible} · dates ${datesVisible} · bullet ${bulletVisible}`,
      companyVisible && datesVisible && bulletVisible && stillOnPaper,
    )
    record(
      `pemandu slot terisi hilang & ghost tetap ada — ${id}`,
      `guide sisa ${guideLeft} · ghost ${ghostsBefore} → ${ghostsAfter}`,
      guideLeft === 0 && ghostsBefore > 0 && ghostsAfter > 0,
    )

    // Ghost row harus tetap terlihat di dalam lembar (tidak terpotong).
    const clipping = await page.evaluate(() => {
      const ghosts = [...document.querySelectorAll('#pane-preview [data-canvas-ghost]')]
      let worst = 0
      for (const ghost of ghosts) {
        const sheet = ghost.closest('[data-probe="page-sheet"]')
        if (!sheet) return { missing: true, worst: 999 }
        const delta = ghost.getBoundingClientRect().bottom - sheet.getBoundingClientRect().bottom
        if (delta > worst) worst = delta
      }
      return { missing: false, worst: Math.round(worst) }
    })
    record(
      `ghost row tidak terpotong lembar — ${id}`,
      `${clipping.missing ? 'ghost di luar lembar' : `sisa ${clipping.worst}px di bawah`}`,
      !clipping.missing && clipping.worst <= 0,
    )

    await page
      .locator('#pane-preview [data-probe="page-sheet"]')
      .first()
      .screenshot({ path: `${OUT}/c4-entry-${id}.png` })
  } catch (error) {
    record(`alur entry kanvas — ${id}`, String(error).slice(0, 160), false)
  } finally {
    await context.close()
  }
}

/* ============ PASS B — PDF dari CV yang disusun di kanvas (D5/D12) ========== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  try {
    await openCanvasEmpty(page)
    await typeSegment(page, '#pane-preview [data-field="profile.fullName"]', 'Budi Santoso')
    await typeSegment(page, '#pane-preview [data-field="profile.headline"]', ROLE)
    await typeSegment(page, '#pane-preview [data-field="profile.email"]', 'budi@mail.com')
    await typeSegment(page, '#pane-preview [data-field="profile.phone"]', '+62 812 3456 7890')
    await typeSegment(
      page,
      '#pane-preview [data-field="summary.text"]',
      'Membangun antarmuka web yang cepat dan mudah dibaca mesin.',
      'Control+Enter',
    )
    await authorExperienceEntry(page)

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      page.locator('[data-probe="download-pdf"]:visible').last().click(),
    ])
    const file = await download.path()
    const bytes = readFileSync(file)
    writeFileSync(path.join(OUT, 'c4-canvas-export.pdf'), bytes)

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes).slice() }).promise
    let text = ''
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const pdfPage = await pdf.getPage(index)
      const content = await pdfPage.getTextContent()
      text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n'
      await pdfPage.cleanup()
    }
    const flat = text.replace(/\s+/g, ' ')

    for (const needle of ['Budi Santoso', ROLE, COMPANY, BULLET, 'Mar 2021', 'Mei 2024']) {
      record(`PDF memuat isi dari kanvas: ${needle}`, flat.includes(needle) ? 'ada' : 'hilang', flat.includes(needle))
    }
    const leaked = CANVAS_ONLY_TEXTS.filter((phrase) => flat.includes(phrase))
    record(
      'PDF bebas teks ghost row & pemandu',
      leaked.length === 0 ? 'bersih' : leaked.join(', '),
      leaked.length === 0,
    )
    record('jumlah halaman PDF (CV dari kanvas)', `${pdf.numPages} halaman`, pdf.numPages >= 1)

    writeFileSync(
      path.join(OUT, 'fase12-c4.json'),
      JSON.stringify({ results, pdfText: text.trim().slice(0, 4000) }, null, 2),
    )
  } catch (error) {
    record(`PDF dari CV hasil kanvas`, String(error).slice(0, 160), false)
  } finally {
    await context.close()
  }
}

await browser.close()

const failed = results.filter((item) => !item.pass)
console.log('------------------------------------------------------------------------------')
console.log(`hasil: ${results.length - failed.length}/${results.length} pemeriksaan lolos`)
if (failed.length > 0) {
  console.log('gagal:', failed.map((item) => item.label).join(' | '))
  process.exitCode = 1
}
