/**
 * evidence-fase9.mjs — bukti terukur T9.4 (performa) untuk Gate Fase 9.
 *
 * Persiapan (jalankan sebelum skrip ini):
 *   pnpm build
 *   pnpm vite preview --port 4199 --strictPort     # produksi (INP, bundle)
 *   pnpm dev --port 4173 --strictPort              # dev (React Profiler)
 *
 * Jalankan: node scripts/evidence-fase9.mjs
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const PROD = process.env.E2E_BASE ?? 'http://localhost:4199'
const DEV = process.env.E2E_DEV_BASE ?? 'http://localhost:4173'
const OUT_DIR = path.resolve('artifacts', 'fase9')
mkdirSync(OUT_DIR, { recursive: true })
const results = []

const record = (label, pass, detail) => {
  results.push({ label, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label} — ${detail}`)
}

const INP_INIT = () => {
  window.__interactions = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const interaction = entry
      window.__interactions.push({
        kind: interaction.name,
        duration: Math.round(interaction.duration),
        time: Math.round(interaction.startTime),
      })
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true })
}

const readInteractions = (page) =>
  page.evaluate(() => {
    const items = (window.__interactions ?? []).filter((i) => i.duration > 0)
    const durations = items.map((i) => i.duration).sort((a, b) => a - b)
    const percentile = (p) =>
      durations.length === 0
        ? 0
        : durations[Math.min(durations.length - 1, Math.floor(durations.length * p))]
    const keyDurations = items
      .filter((i) => /key(down|press|up)|input/.test(i.kind))
      .map((i) => i.duration)
      .sort((a, b) => a - b)
    const keyPercentile = (p) =>
      keyDurations.length === 0
        ? 0
        : keyDurations[Math.min(keyDurations.length - 1, Math.floor(keyDurations.length * p))]
    return {
      count: durations.length,
      max: durations.at(-1) ?? 0,
      p98: percentile(0.98),
      median: percentile(0.5),
      over200: durations.filter((d) => d > 200).length,
      keyCount: keyDurations.length,
      keyMax: keyDurations.at(-1) ?? 0,
      keyP98: keyPercentile(0.98),
      worst: items
        .slice()
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 6),
    }
  })

// ---------------------------------------------------------------- INP @ 4× CPU
{
  const browser = await chromium.launch({ args: ['--enable-blink-features=ComputePressureV2'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(INP_INIT)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)

  await page.goto(`${PROD}/`, { waitUntil: 'load' })
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('radio', { name: /Nanti saja/ }).click()
    await later.click()
  }

  // "Perangkat rendah": Chrome 4× CPU throttling.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

  await page
    .locator('aside[aria-label="Bagian"] nav')
    .getByRole('button')
    .filter({ hasText: 'Pengalaman' })
    .first()
    .click()
  const bullet = page.getByRole('textbox', { name: /Isi bullet 1/ })
  const startMs = Date.now()
  await bullet.click()
  await bullet.pressSequentially(
    'Membangun layanan rekonsilasi inventaris yang memproses 2 juta pembaruan SKU setiap malam dengan keberhasilan 99,9 persen dan menurunkan hotfix rilis sebanyak 45 persen. ',
    { delay: 18 },
  )
  const summaryR = page.locator('#summary-text')
  if (await summaryR.count()) {
    await page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Ringkasan' })
      .first()
      .click()
    await summaryR.click()
    await summaryR.pressSequentially(
      'Insinyur perangkat lunak dengan enam tahun membangun layanan web bervolume tinggi di fintech dan marketplace, nyaman di seluruh stack, dan terbiasa mengukur dampak. ',
      { delay: 18 },
    )
  }
  const elapsedMs = Date.now() - startMs

  const stats = await readInteractions(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await page.screenshot({ path: path.join(OUT_DIR, 'inp-4x-cpu.png') })
  // INP resmi = persentil 98 dari interaksi dalam sesi (definition-of-done T9.4
  // memakai angka itu). Maks ikut dilaporkan supaya sesi ini tidak bisa
  // bersembunyi di belakang satu kejadian sesaat.
  record(
    'INP @ CPU 4× (build produksi, dua field nyata)',
    stats.p98 <= 200 && stats.keyMax <= 200,
    `ketikan ${elapsedMs} ms · ${stats.count} interaksi >16ms · INP(p98) ${stats.p98}ms · median ${stats.median}ms · maks ${stats.max}ms · keydown/input ${stats.keyCount}× (p98 ${stats.keyP98}ms, maks ${stats.keyMax}ms) · ${stats.over200} di atas 200ms · terburuk ${JSON.stringify(stats.worst.slice(0, 3))}`,
  )
  writeFileSync(path.join(OUT_DIR, 'inp-4x.json'), JSON.stringify({ elapsedMs, ...stats }, null, 2))
  await browser.close()
}

// -------------------------------------------------- React Profiler 60 detik
{
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(INP_INIT)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)

  await page.goto(`${DEV}/`, { waitUntil: 'load' })
  await page.locator('#pane-preview [data-probe="page-sheet"]').first().waitFor({ timeout: 20_000 })
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('radio', { name: /Nanti saja/ }).click()
    await later.click()
  }
  await page.evaluate(() => {
    window.__atsPreviewRenders = []
  })

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page
    .locator('aside[aria-label="Bagian"] nav')
    .getByRole('button')
    .filter({ hasText: 'Pengalaman' })
    .first()
    .click()
  const bullet = page.getByRole('textbox', { name: /Isi bullet 1/ })
  await bullet.click()

  // Sesi mengetik ±60 detik; kalimat diputar supaya tidak menyentuh batas karakter.
  const sentence =
    'Meningkatkan waktu muat dasbor dari sembilan detik menjadi 1,2 detik dengan menata ulang kueri agregasi. '
  const startMs = Date.now()
  let keystrokes = 0
  while (Date.now() - startMs < 60_000) {
    await bullet.pressSequentially(sentence.slice(0, 40), { delay: 12 })
    keystrokes += 40
    const value = await bullet.inputValue()
    if (value.length > 380) {
      await bullet.fill('')
    }
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  const probe = await page.evaluate(() => {
    const rows = window.__atsPreviewRenders ?? []
    const durations = rows.map((r) => r.duration).sort((a, b) => a - b)
    const byId = {}
    for (const row of rows) {
      byId[row.id] = (byId[row.id] ?? 0) + 1
    }
    return {
      renders: rows.length,
      over16: durations.filter((d) => d > 16).length,
      max: durations.at(-1) ?? 0,
      p95: durations[Math.floor(durations.length * 0.95)] ?? 0,
      distinctBlocks: Object.keys(byId).length,
      busiest: Object.entries(byId)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    }
  })
  const interactions = await readInteractions(page)
  await page.screenshot({ path: path.join(OUT_DIR, 'profiler-60s.png') })

  record(
    'React Profiler: sesi mengetik 60 detik tanpa render >16ms berulang',
    probe.over16 <= Math.max(3, Math.round(probe.renders * 0.02)),
    `${keystrokes} keystroke · ${probe.renders} render blok · ${probe.over16} di atas 16ms (${((probe.over16 / probe.renders) * 100).toFixed(2)}%; p95 ${probe.p95}ms, maks ${probe.max}ms) · ${probe.distinctBlocks} blok berbeda · blok tersering ${JSON.stringify(probe.busiest)} · (dev, keydown maks ${interactions.keyMax}ms — dev build ±3× lebih lambat dari produksi)`,
  )
  writeFileSync(
    path.join(OUT_DIR, 'profiler-60s.json'),
    JSON.stringify({ keystrokes, probe, interactions }, null, 2),
  )
  await browser.close()
}

// ---------------------------------------------------------------- bundle awal
{
  const html = readFileSync(path.resolve('dist', 'index.html'), 'utf8')
  const eager = new Set()
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)) eager.add(m[1])
  const walk = (dir) => {
    const out = []
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name)
      if (item.isDirectory()) out.push(...walk(full))
      else out.push(full)
    }
    return out
  }
  const distFiles = walk(path.resolve('dist'))
  let totalGzip = 0
  const lines = []
  for (const file of distFiles) {
    const rel = '/' + path.relative(path.resolve('dist'), file).replaceAll('\\', '/')
    if (!/\.(js|css)$/.test(rel)) continue
    if (!eager.has(rel)) continue
    const gz = gzipSync(readFileSync(file)).length
    totalGzip += gz
    lines.push(`${rel} = ${(gz / 1024).toFixed(2)} KB gzip`)
  }
  const htmlGz = gzipSync(Buffer.from(html)).length
  totalGzip += htmlGz
  lines.push(`index.html = ${(htmlGz / 1024).toFixed(2)} KB gzip`)
  const kb = totalGzip / 1024
  // Keputusan owner Fase 9 no. 1: budget 220 KB tidak dikejar lewat diet bundle
  // di fase QA ini, jadi angka dilaporkan sebagai catatan, bukan pemeriksaan.
  console.log(
    `CATATAN — bundle awal ${kb.toFixed(2)} KB gzip vs budget T9.4 220 KB (${kb <= 220 ? 'dalam budget' : 'LEWAT budget; diet bundle ditunda owner'}): ${lines.join(', ')}`,
  )
}

const passed = results.filter((r) => r.pass).length
writeFileSync(path.join(OUT_DIR, 'perf-summary.json'), JSON.stringify(results, null, 2))
console.log(`\n${passed}/${results.length} pemeriksaan lolos`)
process.exit(passed === results.length ? 0 : 1)
