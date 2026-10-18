/* Bukti Gate Fase 4 — mesin preview layar & manajemen halaman.
 *
 * Dua pass, karena angkanya beda makna:
 *   PASS A (dev, http://localhost:5173/dev/pagination): fixture pendek/sedang/
 *     panjang, posisi break, margin guide, zoom 50/75/100/150/Fit, bukti React
 *     Profiler per blok, keyboard-only, preferensi tersimpan, 4 breakpoint.
 *   PASS B (build, http://localhost:4173): latensi input→preview (gate <100ms),
 *     longtask, dan alur offline (P2). Build produksi dipakai untuk angka latensi
 *     karena bundel dev membawa instrumen React DEV yang menambah ~200ms per
 *     ketikan (diukur: dev p95 ~330ms vs build p95 ~15ms).
 *
 * Persiapan: `pnpm dev` (5173) dan `pnpm build && pnpm preview` (4173), lalu
 *   node scripts/evidence-fase4.mjs
 * Keluaran: artifacts/evidence/fase4-*.png + artifacts/evidence/fase4-pagination.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const DEV_BASE = process.env.E2E_BASE ?? 'http://localhost:5173'
const PROD_BASE = process.env.PROD_BASE ?? 'http://localhost:4173'
const OUT = 'artifacts/evidence'
const PX_PER_MM = 96 / 25.4

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const results = []
const note = (label, value, detail = '') => {
  results.push({ label, value, pass: null, detail })
  console.log(`CATATAN ${label}: ${value}${detail ? ` — ${detail}` : ''}`)
}

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

const chooseZoom = async (page, preset) => {
  if ((await page.locator('[data-probe="zoom-value"]').textContent())?.trim() === preset) return
  await page.locator('[data-probe="zoom-value"]').click()
  await page.getByRole('button', { name: preset, exact: true }).last().click()
  await page.waitForTimeout(250)
}

const readPages = (page) =>
  page.evaluate(() => {
    const sheets = [...document.querySelectorAll('[data-probe="page-sheet"]')]
    return sheets.map((sheet, index) => {
      const blocks = [...sheet.querySelectorAll('[data-probe="preview-block"]')]
      const last = blocks.at(-1)?.getBoundingClientRect()
      return {
        page: index + 1,
        blocks: blocks.length,
        firstKey: blocks[0]?.dataset.blockKey ?? '',
        lastKey: blocks.at(-1)?.dataset.blockKey ?? '',
        firstText: (blocks[0]?.textContent ?? '').slice(0, 48),
        lastText: (blocks.at(-1)?.textContent ?? '').slice(0, 48),
        unusedBottomPx: last ? Math.round(sheet.getBoundingClientRect().bottom - last.bottom) : 0,
      }
    })
  })

/* ============================================================ PASS A — dev ==== */
const pagination = {}
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(`${DEV_BASE}/dev/pagination`)
  await page.locator('[data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page)

  // 1. fixture pendek / sedang / panjang + posisi break (acuan silang Fase 5)
  for (const fixture of ['pendek', 'sedang', 'panjang']) {
    await page.locator(`[data-fixture="${fixture}"]`).click()
    await page.waitForTimeout(500)
    await chooseZoom(page, '100%')
    const pagesInfo = await readPages(page)
    pagination[fixture] = { pageCount: pagesInfo.length, pages: pagesInfo }
    const counter = (await page.locator('[data-probe="page-counter"]').textContent())?.trim()
    const chip = await page.locator('[data-probe="page-chip"]').count()
    const lastFits = pagesInfo.at(-1)?.unusedBottomPx >= 18 * PX_PER_MM - 2
    record(
      `fixture ${fixture}: jumlah halaman & break`,
      `${pagesInfo.length} halaman · ${counter}`,
      Boolean(lastFits),
      `blok/halaman=${pagesInfo.map((item) => item.blocks).join(',')} · chip=${chip} · awal halaman=[${pagesInfo
        .map((item) => `${item.page}:${item.firstText.slice(0, 16)}`)
        .join(' | ')}] · akhir halaman=[${pagesInfo
        .map((item) => `${item.page}:${item.lastText.slice(0, 16)}`)
        .join(' | ')}]`,
    )
    await page.screenshot({ path: `${OUT}/fase4-pagination-${fixture}.png` })
  }
  const counts = ['pendek', 'sedang', 'panjang'].map((name) => pagination[name].pageCount)
  record(
    'jumlah halaman naik monoton',
    counts.join(' < '),
    counts[0] === 1 && counts[1] >= 2 && counts[2] > counts[1],
  )

  // 2. margin guide vs margin template pada zoom 100%
  await chooseZoom(page, '100%')
  const guides = await page.evaluate(() => {
    const box = document.querySelector('[data-probe="margin-ruler"] > div')?.getBoundingClientRect()
    const name = document
      .querySelector('[data-block-kind="header"]')
      ?.querySelector('div')
      ?.getBoundingClientRect()
    const sheet = document.querySelector('[data-probe="page-sheet"]')?.getBoundingClientRect()
    return {
      guideLeft: Math.round(box?.left ?? 0),
      textLeft: Math.round(name?.left ?? 0),
      measuredMarginPx: (box?.left ?? 0) - (sheet?.left ?? 0),
    }
  })
  record(
    'garis margin = titik awal teks (zoom 100%)',
    `guide ${guides.guideLeft}px vs teks ${guides.textLeft}px`,
    Math.abs(guides.guideLeft - guides.textLeft) <= 1,
    `margin terukur ${guides.measuredMarginPx.toFixed(2)}px = ${(guides.measuredMarginPx / PX_PER_MM).toFixed(2)} mm (override dokumen 18 mm)`,
  )
  await page.screenshot({ path: `${OUT}/fase4-margin-guides.png` })

  // 3. rentang zoom 50–150% lewat tombol +/-
  for (const [preset, expectedWidth, direction] of [
    ['50%', 397, 'Perkecil'],
    ['150%', 1191, 'Perbesar'],
  ]) {
    await chooseZoom(page, '100%')
    for (let index = 0; index < 5; index += 1)
      await page.getByRole('button', { name: direction }).click()
    const state = await page.evaluate(() => {
      const sheet = document.querySelector('[data-probe="page-sheet"]')?.getBoundingClientRect()
      return {
        sheetWidth: Math.round(sheet?.width ?? 0),
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        label: document.querySelector('[data-probe="zoom-value"]')?.textContent?.trim() ?? '',
      }
    })
    record(
      `zoom ${preset} (${state.label}) — lebar lembar & tanpa scroll horizontal liar`,
      `${state.sheetWidth}px · overflow dokumen ${state.docOverflow}px`,
      Math.abs(state.sheetWidth - expectedWidth) <= 2 &&
        state.docOverflow <= 0 &&
        state.bodyOverflow <= 0,
    )
    await page.screenshot({ path: `${OUT}/fase4-zoom-${preset.replace('%', '')}.png` })
  }

  // 4. mode Fit + pinch-zoom
  await chooseZoom(page, 'Fit')
  const fit = await page.evaluate(() => {
    const well = document.querySelector('#pane-preview')
    const sheet = document.querySelector('[data-probe="page-sheet"]')
    return {
      wellClientWidth: well?.clientWidth ?? 0,
      sheetWidth: Math.round(sheet?.getBoundingClientRect().width ?? 0),
      label: document.querySelector('[data-probe="zoom-value"]')?.textContent?.trim() ?? '',
      wellTouchAction: well ? getComputedStyle(well).touchAction : '',
      sheetTouchAction: sheet ? getComputedStyle(sheet).touchAction : '',
    }
  })
  record(
    'mode Fit = (lebar well − 48) / 794',
    `lembar ${fit.sheetWidth}px untuk well ${fit.wellClientWidth}px`,
    Math.abs(fit.sheetWidth - (fit.wellClientWidth - 48)) <= 2 && fit.label === 'Fit',
  )
  // Chromium serialisasi `pan-x pan-y pinch-zoom` sebagai `manipulation` (setara);
  // yang diuji: well mengizinkan pinch, lembar tidak memegang touch-action sendiri.
  record(
    'pinch-zoom di well, bukan di lembar',
    `well=${fit.wellTouchAction} · sheet=${fit.sheetTouchAction}`,
    ['manipulation', 'pan-x pan-y pinch-zoom'].includes(fit.wellTouchAction) &&
      fit.sheetTouchAction === 'auto',
  )
  await page.screenshot({ path: `${OUT}/fase4-zoom-fit.png` })

  // 5. bukti React Profiler: satu ketikan bullet hanya merender blok itu
  await chooseZoom(page, '100%')
  await page
    .locator('aside')
    .getByRole('button', { name: /Pengalaman/ })
    .first()
    .click()
  await page.waitForTimeout(250)
  await page.locator('textarea[id^="exp-"][id*="-bullet-"]').first().click()
  await page.evaluate(() => {
    window.__atsPreviewRenders.length = 0
  })
  await page.keyboard.type('x')
  await page.waitForTimeout(300)
  const renderIds = await page.evaluate(() => [
    ...new Set(window.__atsPreviewRenders.map((item) => item.id)),
  ])
  const blockIds = renderIds.filter((id) => id !== 'preview-tree')
  record(
    'React Profiler: 1 ketikan bullet',
    `${blockIds.length} blok dirender`,
    blockIds.length === 1 && /:l\d+$/.test(blockIds[0] ?? ''),
    blockIds.join(' , '),
  )

  // 6. keyboard-only di toolbar preview
  const trail = []
  await page.getByRole('button', { name: 'Perkecil' }).focus()
  for (let index = 0; index < 6; index += 1) {
    trail.push(
      await page.evaluate(() => {
        const el = document.activeElement
        return `${el?.tagName}:${(el?.getAttribute('aria-label') ?? el?.textContent ?? '').trim().slice(0, 22)}`
      }),
    )
    await page.keyboard.press('Tab')
  }
  const names = ['Perkecil', 'Perbesar', 'Penggaris margin'].filter((name) =>
    trail.some((item) => item.includes(name)),
  )
  record(
    'toolbar preview dapat dijangkau Tab',
    names.join(' · '),
    names.length === 3,
    trail.slice(0, 6).join(' → '),
  )
  await page.getByRole('button', { name: 'Penggaris margin' }).focus()
  const before = await page.locator('[data-probe="margin-ruler"]').count()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const after = await page.locator('[data-probe="margin-ruler"]').count()
  const pressed = await page
    .getByRole('button', { name: 'Penggaris margin' })
    .getAttribute('aria-pressed')
  record(
    'Enter pada toggle penggaris mengubah state',
    `${before} → ${after}`,
    before !== after,
    `aria-pressed=${pressed}`,
  )
  const focusRing = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement)
    return `${style.boxShadow.slice(0, 30)} | outline ${style.outlineWidth} ${style.outlineColor}`
  })
  record(
    'ring fokus terlihat saat navigasi keyboard',
    focusRing,
    /15, 90, 120|2px|3px/.test(focusRing),
  )
  await page.screenshot({ path: `${OUT}/fase4-keyboard-only.png` })

  // 7. preferensi tersimpan di ats:prefs:v1
  await chooseZoom(page, '50%')
  await page.reload()
  await page.locator('[data-probe="page-sheet"]').first().waitFor()
  await dismissFirstRun(page)
  const persisted = await page.evaluate(async () =>
    (await import('/src/features/persistence/idb.ts')).readValue('ats:prefs:v1'),
  )
  record(
    'zoom/fit/guides persist di ats:prefs:v1',
    JSON.stringify(persisted),
    persisted?.zoom === 0.5 && persisted?.fitMode === false,
  )

  // 8. empat breakpoint
  for (const width of [360, 768, 1024, 1440]) {
    const shotContext = await browser.newContext({ viewport: { width, height: 900 } })
    const shotPage = await shotContext.newPage()
    await shotPage.goto(`${DEV_BASE}/dev/pagination`)
    await dismissFirstRun(shotPage)
    const previewTab = shotPage.getByRole('tab', { name: 'Pratinjau' })
    if (
      await previewTab
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false)
    )
      await previewTab.click()
    await shotPage.locator('[data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
    await shotPage.waitForTimeout(700)
    const numbers = await shotPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sheet: Math.round(
        document.querySelector('[data-probe="page-sheet"]')?.getBoundingClientRect().width ?? 0,
      ),
      captions: document.querySelectorAll('[data-probe="page-caption"]').length,
    }))
    record(
      `breakpoint ${width}px`,
      `overflow ${numbers.overflow}px · lembar ${numbers.sheet}px · ${numbers.captions} caption`,
      numbers.overflow <= 0 && numbers.sheet > 0 && numbers.sheet <= width,
    )
    await shotPage.screenshot({ path: `${OUT}/fase4-bp-${width}.png` })
    await shotContext.close()
  }
  await context.close()
}

/* ========================================================= PASS B — build ==== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  const page = await context.newPage()
  await page.goto(PROD_BASE)
  await page.locator('[data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  await dismissFirstRun(page)
  await page
    .locator('aside')
    .getByRole('button', { name: /Pengalaman/ })
    .first()
    .click()

  const measureLatency = async (selector, text) => {
    await page.locator(selector).first().click()
    await page.waitForTimeout(250)
    await page.evaluate((target) => {
      window.__lat = []
      window.__long = []
      window.__pending = null
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__long.push(Math.round(entry.duration))
      }).observe({ entryTypes: ['longtask'] })
      new MutationObserver(() => {
        if (window.__pending === null) return
        window.__lat.push(performance.now() - window.__pending)
        window.__pending = null
      }).observe(document.querySelector('[data-probe="preview-renderer"]'), {
        subtree: true,
        childList: true,
        characterData: true,
      })
      document.querySelector(target).addEventListener('input', () => {
        window.__pending = performance.now()
      })
    }, selector)
    await page.keyboard.type(text, { delay: 90 })
    await page.waitForTimeout(1200)
    return page.evaluate(() => ({ lat: window.__lat, long: window.__long }))
  }

  const bulletSelector = 'textarea[id^="exp-"][id*="-bullet-"]'
  const stats = (values) => {
    const sorted = [...values].sort((a, b) => a - b)
    return {
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      max: sorted.at(-1) ?? 0,
    }
  }

  const online = await measureLatency(bulletSelector, 'wxyz1234wxyz5678')
  const onlineStats = stats(online.lat.map((value) => Math.round(value)))
  record(
    'Gate: preview berubah < 100ms setelah keystroke (build produksi)',
    `median ${onlineStats.median}ms · p95 ${onlineStats.p95}ms · maks ${onlineStats.max}ms`,
    online.lat.length >= 8 && onlineStats.p95 < 100,
    `${online.lat.length} ketikan · longtask: ${online.long.length === 0 ? 'tidak ada' : online.long.join(',')}`,
  )

  await context.setOffline(true)
  const offline = await measureLatency(bulletSelector, 'wxyz1234wxyz5678')
  const offlineStats = stats(offline.lat.map((value) => Math.round(value)))
  record(
    'P2 local-first: isi + preview tetap jalan tanpa jaringan',
    `median ${offlineStats.median}ms · maks ${offlineStats.max}ms · ${offline.lat.length} ketikan`,
    offline.lat.length >= 8 && offlineStats.max < 100,
    `longtask offline: ${offline.long.length === 0 ? 'tidak ada' : offline.long.join(',')}`,
  )
  await page.screenshot({ path: `${OUT}/fase4-offline-preview.png` })
  await context.setOffline(false)

  await page
    .locator('aside')
    .getByRole('button', { name: /Ringkasan/ })
    .first()
    .click()
  const summary = await measureLatency('textarea', 'Migrasi monolith ke layanan')
  const summaryStats = stats(summary.lat.map((value) => Math.round(value)))
  record(
    'textarea panjang (Ringkasan): teks < 100ms walau re-layout ditahan 60ms',
    `median ${summaryStats.median}ms · maks ${summaryStats.max}ms`,
    summary.lat.length >= 8 && summaryStats.max < 100,
    `${summary.lat.length} ketikan · ${summary.lat.map((v) => Math.round(v)).join(', ')}`,
  )

  await page
    .locator('aside')
    .getByRole('button', { name: /Pengalaman/ })
    .first()
    .click()
  await page.waitForTimeout(200)
  await page.locator(bulletSelector).first().click()
  await page.evaluate(() => {
    window.__frames = 0
    window.__stop = false
    const tick = () => {
      window.__frames += 1
      if (!window.__stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const typingStart = Date.now()
  await page.keyboard.type('kualitas preview saat mengetik cepat', { delay: 83 })
  const typingSeconds = (Date.now() - typingStart) / 1000
  const typing = await page.evaluate(() => {
    window.__stop = true
    return window.__frames
  })
  await page.evaluate(() => {
    window.__frames = 0
    window.__stop = false
    const tick = () => {
      window.__frames += 1
      if (!window.__stop) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.waitForTimeout(2500)
  const idle = await page.evaluate(() => {
    window.__stop = true
    return window.__frames
  })
  note(
    'T4.5 target 55fps @120wpm tidak dapat dipastikan di sini',
    `${(typing / typingSeconds).toFixed(1)} fps saat mengetik · ${(idle / 2.5).toFixed(1)} fps idle`,
    'headless Chromium mesin ini tidak men-sinkron rAF ke 60Hz (pernah terbaca 106 & 155 fps), jadi angka fps tidak valid; yang valid: latensi & longtask di atas',
  )
  await page.screenshot({ path: `${OUT}/fase4-prod-workspace.png` })
  await context.close()
}

await browser.close()
writeFileSync(`${OUT}/fase4-pagination.json`, JSON.stringify({ pagination, results }, null, 2))
const checked = results.filter((item) => item.pass !== null)
const failed = checked.filter((item) => !item.pass)
console.log(`\n${checked.length - failed.length}/${checked.length} pemeriksaan lolos`)
if (failed.length > 0) {
  console.log('BELUM TERBUKTI:', failed.map((item) => `${item.label} (${item.value})`).join(' | '))
  process.exitCode = 1
}
