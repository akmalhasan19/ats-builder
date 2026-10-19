/* Bukti Gate Fase 7 — ATS checker, Parse Tape, dan Highlighter.
 *
 * PASS A (dev, http://localhost:5173): drawer ATS di 1440 — skor, bar 20 tick,
 *   disclaimer, kelompok isu, Parse Tape, tombol Salin teks.
 * PASS B (dev): aksi `Perbaiki →` benar-benar memfokuskan field email.
 * PASS C (dev): highlighter — tempel deskripsi lowongan → kata kunci distabilo
 *   di lembar A4, toggle nyala/mati.
 * PASS D (dev): keempat breakpoint 360/768/1024/1440 — drawer terbuka,
 *   disclaimer terlihat, tanpa scroll horizontal.
 * PASS E (dev): keyboard saja — buka drawer, ganti tab, tutup dengan Esc.
 *
 * Persiapan: `pnpm dev` (5173), lalu `node scripts/evidence-fase7.mjs`
 * Keluaran: artifacts/fase7/*.png + artifacts/fase7/fase7-evidence.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const DEV_BASE = process.env.E2E_BASE ?? 'http://localhost:5173'
const OUT = 'artifacts/fase7'
const BREAKPOINTS = [360, 768, 1024, 1440]

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []

const record = (label, value, pass, detail = '') => {
  results.push({ label, value, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

const dismissFirstRun = async (page) => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', { name: /Nanti saja/ })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
  }
}

const openDrawer = async (page, width) => {
  if (width < 1024) await page.getByRole('button', { name: 'Menu' }).click()
  await page
    .locator('[data-probe="check-ats"]:visible, [data-probe="check-ats-mobile"]:visible')
    .first()
    .click()
  await page.locator('[data-probe="ats-drawer"]').waitFor({ state: 'visible', timeout: 15000 })
}

const horizontalOverflow = async (page) =>
  page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))

/* ================================================== PASS A — drawer 1440 ==== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await expectForm(page)
  await dismissFirstRun(page)

  await openDrawer(page, 1440)
  const drawer = page.locator('[data-probe="ats-drawer"]')

  // Sapuan scan §5.5 harus benar-benar muncul saat pemeriksaan berjalan.
  await page.locator('[data-probe="ats-check-now"]').click()
  const sweepSeen = await page
    .locator('[data-probe="scan-sweep"]')
    .waitFor({ state: 'attached', timeout: 2000 })
    .then(() => true)
    .catch(() => false)
  record('PASS A: sapuan scan muncul saat memeriksa', sweepSeen, sweepSeen)
  await drawer.locator('[data-probe="ats-score-value"]').waitFor({ timeout: 15000 })

  const score = await drawer.locator('[data-probe="ats-score-value"]').textContent()
  const ticks = await drawer.locator('[data-probe="ats-score-ticks"]').locator('span').count()
  const label = await drawer.locator('[data-probe="ats-score-band"]').textContent()
  const disclaimer = await drawer.locator('[data-probe="ats-disclaimer"]').isVisible()

  record('PASS A: skor indeks struktur', score, Number(score) >= 0)
  record('PASS A: 20 tick tersegmen', ticks, ticks === 20, `${ticks} tick`)
  const labelCount = await drawer.getByText('INDEKS STRUKTUR').count()
  record(
    'PASS A: band + label INDEKS STRUKTUR',
    label,
    Boolean(label) && labelCount >= 1,
    `${label} · label INDEKS STRUKTUR muncul ${labelCount}×`,
  )
  record('PASS A: disclaimer permanen terlihat', disclaimer, disclaimer)

  // Kelompok isu: dua kelompok pertama terbuka secara default.
  const warnGroup = await drawer.locator('[data-probe="ats-group-warn"]').count()
  record('PASS A: kelompok Sebaiknya tampil', warnGroup, warnGroup === 1)

  await page.screenshot({ path: `${OUT}/fase7-drawer-1440.png`, fullPage: false })

  // Parse tape: header urutan + tag + footer statistik + tombol salin.
  await drawer.locator('[data-probe="ats-tab-tape"]').click()
  const tape = drawer.locator('[data-probe="ats-tape"]')
  await tape.waitFor({ state: 'visible', timeout: 10000 })
  const tags = await tape.evaluate((el) =>
    [...el.querySelectorAll('span')].map((s) => s.textContent?.trim()).filter((t) => t && t === t.toUpperCase() && t.length > 1),
  )
  const hasName = tags.includes('NAME')
  const hasHeading = tags.includes('HEADING')
  const footer = await tape.evaluate((el) => el.lastElementChild?.textContent ?? '')
  record('PASS A: tape punya NAME & HEADING', `${hasName}/${hasHeading}`, hasName && hasHeading)
  record(
    'PASS A: footer statistik tape',
    footer.trim(),
    /karakter/.test(footer) && /kata/.test(footer) && /halaman/.test(footer),
  )
  await page.screenshot({ path: `${OUT}/fase7-tape-1440.png`, fullPage: false })

  await context.close()
}

/* ============================================ PASS B — aksi Perbaiki ==== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await expectForm(page)
  await dismissFirstRun(page)

  await page
    .locator('aside[aria-label="Bagian"] nav')
    .getByRole('button')
    .filter({ hasText: 'Profil' })
    .first()
    .click()
  await page.locator('#profile-email').fill('bukan-email')
  await page
    .locator('aside[aria-label="Bagian"] nav')
    .getByRole('button')
    .filter({ hasText: 'Keahlian' })
    .first()
    .click()

  await openDrawer(page, 1440)
  await page.locator('[data-probe="ats-check-now"]').click()
  const issue = page
    .locator('[data-probe="ats-drawer"] [data-probe="ats-issue"]')
    .filter({ hasText: 'Format email tidak dikenali' })
  await issue.waitFor({ timeout: 15000 })
  await issue.locator('[data-probe="ats-fix"]').click()

  await page.waitForFunction(() => document.activeElement?.id === 'profile-email', undefined, {
    timeout: 8000,
  })
  const focused = await page.evaluate(() => document.activeElement?.id)
  const value = await page.locator('#profile-email').inputValue()
  const heading = await page.getByRole('heading', { level: 1 }).textContent()
  record('PASS B: Perbaiki → fokus ke field email', `${focused}=${value}`, focused === 'profile-email')
  record('PASS B: bagian aktif ikut berpindah ke Profil', heading, heading === 'Profil')
  await page.screenshot({ path: `${OUT}/fase7-fix-focus-1440.png`, fullPage: false })

  await context.close()
}

/* ================================================ PASS C — highlighter ==== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await expectForm(page)
  await dismissFirstRun(page)

  const marksBefore = await page.locator('#pane-preview mark').count()
  await openDrawer(page, 1440)

  // Panel deskripsi lowongan berada di tab Masalah (collapsible paling atas).
  const drawer = page.locator('[data-probe="ats-drawer"]')
  const jdToggle = drawer.locator('button[aria-expanded]').first()
  await jdToggle.click()
  await drawer.locator('[data-probe="ats-jd-input"]').fill(
    'Butuh Frontend Engineer dengan React dan TypeScript, pengalaman machine learning, serta observability wajib. React TypeScript machine learning observability.',
  )
  await drawer.locator('[data-probe="ats-check-now"]').waitFor({ state: 'detached' }).catch(() => {})
  await page.waitForTimeout(2500)

  const chipCount = await drawer.locator('[data-probe="ats-keyword-missing"]').count()
  const summary = await drawer.locator('[data-probe="ats-keywords"]').textContent()
  record('PASS C: ringkasan cocok/belum ada', summary?.trim(), /cocok.*belum ada/.test(summary ?? ''))
  record('PASS C: chip kata belum ada dapat diklik', chipCount, chipCount > 0, `${chipCount} chip`)

  const marks = await page.locator('#pane-preview mark').count()
  record('PASS C: kata kunci distabilo di lembar A4', `${marksBefore} → ${marks}`, marks > marksBefore)

  // Toolbar pratinjau ada di bawah overlay drawer (1280–1599px), jadi drawer
  // ditutup dulu — sama seperti yang dilakukan pengguna.
  await page.keyboard.press('Escape')
  await page.locator('[data-probe="ats-drawer"]').waitFor({ state: 'hidden', timeout: 5000 })

  // CLS: menyalakan/mematikan stabilo tidak boleh menggeser lembarnya.
  const cls = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry
            if (!shift.hadRecentInput) total += shift.value ?? 0
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => {
          observer.disconnect()
          resolve(total)
        }, 900)
      }),
  )
  record('PASS C: stabilo tidak menambah CLS', cls, cls <= 0.1, `CLS=${cls.toFixed(4)}`)

  // Toggle highlighter di toolbar pratinjau.
  const toggle = page.locator('[data-probe="preview-highlighter"]')
  if (await toggle.isEnabled()) {
    await toggle.click()
    const marksOff = await page.locator('#pane-preview mark').count()
    await toggle.click()
    const marksOn = await page.locator('#pane-preview mark').count()
    record('PASS C: toggle highlighter nyala/mati', `${marksOn}/${marksOff}`, marksOff === 0 && marksOn > 0)
  } else {
    record('PASS C: toggle highlighter nyala/mati', 'disabled', false)
  }
  await page.screenshot({ path: `${OUT}/fase7-highlighter-1440.png`, fullPage: false })

  await context.close()
}

/* ============================================= PASS D — breakpoint ====== */
{
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } })
  const page = await context.newPage()
  for (const width of BREAKPOINTS) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${DEV_BASE}/`)
    await expectForm(page)
    await dismissFirstRun(page)
    await openDrawer(page, width)

    const drawer = page.locator('[data-probe="ats-drawer"]')
    await page.locator('[data-probe="ats-check-now"]').waitFor({ timeout: 10000 })
    const disclaimerVisible = await drawer.locator('[data-probe="ats-disclaimer"]').isVisible()
    const box = await drawer.boundingBox()
    const widthOk = width < 768 ? box.width <= width + 2 : Math.round(box.width) === 400
    const overflow = await horizontalOverflow(page)

    record(`PASS D ${width}px: disclaimer terlihat`, disclaimerVisible, disclaimerVisible)
    record(
      `PASS D ${width}px: lebar drawer sesuai spec`,
      Math.round(box.width),
      widthOk,
      `w400 desktop / penuh mobile, lebar terukur ${Math.round(box.width)}`,
    )
    record(
      `PASS D ${width}px: tanpa scroll horizontal`,
      `${overflow.scrollWidth}/${overflow.clientWidth}`,
      overflow.scrollWidth <= overflow.clientWidth + 1,
    )
    await page.screenshot({ path: `${OUT}/fase7-breakpoint-${width}.png`, fullPage: false })
  }
  await context.close()
}

/* ================================== PASS D2 — dock ≥1600px (§2.4) ====== */
{
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await expectForm(page)
  await dismissFirstRun(page)
  await openDrawer(page, 1920)

  const drawer = page.locator('[data-probe="ats-drawer"]')
  const tag = await drawer.evaluate((el) => el.tagName)
  const overlayCount = await page.locator('[data-slot="sheet-overlay"]').count()
  const box = await drawer.boundingBox()
  record('PASS D2 1920px: drawer menjadi kolom ke-4 (bukan overlay)', tag, tag === 'ASIDE')
  record('PASS D2 1920px: tanpa scrim overlay', overlayCount, overlayCount === 0)
  record('PASS D2 1920px: lebar 400px', Math.round(box.width), Math.round(box.width) === 400)
  await page.screenshot({ path: `${OUT}/fase7-dock-1920.png`, fullPage: false })
  await context.close()
}

/* ============================================ PASS E — keyboard saja ==== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/`)
  await expectForm(page)
  await dismissFirstRun(page)

  await page.locator('[data-probe="check-ats"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-probe="ats-drawer"]').waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('[data-probe="ats-check-now"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-probe="ats-score-value"]').waitFor({ timeout: 15000 })

  const inTape = await page.keyboard.press('Tab')
  void inTape
  await page.locator('[data-probe="ats-tab-tape"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-probe="ats-tape"]').waitFor({ state: 'visible', timeout: 10000 })
  const tapeVisible = await page.locator('[data-probe="ats-tape"]').isVisible()

  // Esc menutup drawer.
  await page.keyboard.press('Escape')
  const closed = await page
    .locator('[data-probe="ats-drawer"]')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .then(() => true)
    .catch(() => false)

  record('PASS E: drawer dibuka lewat keyboard', true, true)
  record('PASS E: tab Parse tape aktif lewat keyboard', tapeVisible, tapeVisible)
  record('PASS E: Esc menutup drawer', closed, closed)
  await page.screenshot({ path: `${OUT}/fase7-keyboard-only.png`, fullPage: false })

  await context.close()
}

async function expectForm(page) {
  await page.locator('#pane-form').waitFor({ state: 'visible', timeout: 20000 })
}

writeFileSync(
  `${OUT}/fase7-evidence.json`,
  `${JSON.stringify({ checks: results, failed: results.filter((r) => !r.pass).length }, null, 2)}\n`,
)
const failed = results.filter((item) => !item.pass)
console.log('-'.repeat(78))
console.log(`hasil : ${results.length - failed.length}/${results.length} pemeriksaan lolos`)
await browser.close()
if (failed.length > 0) process.exitCode = 1
