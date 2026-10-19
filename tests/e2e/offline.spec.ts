import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

/**
 * T9.2 + Gate Fase 9 item 4 — P2 local-first diuji terhadap BUILD PRODUKSI
 * (service worker hanya hidup di sana). Butuh:
 *   pnpm build && pnpm exec playwright test --config=playwright.preview.config.ts
 */

const ARTIFACT_DIR = path.resolve('artifacts', 'fase9')

const dismissFirstRun = async (page: Page): Promise<void> => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    await page.getByRole('radio', { name: /Nanti saja/ }).click()
    await later.click()
    await expect(later).toBeHidden({ timeout: 5000 })
  }
}

/** Di <1024px lembar A4 hidup di tab "Pratinjau" — pindah ke sana bila perlu. */
const showPreview = async (page: Page): Promise<void> => {
  const tab = page.getByRole('tab', { name: 'Pratinjau' })
  if (await tab.isVisible().catch(() => false)) {
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  }
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
    timeout: 10_000,
  })
}

test('offline: reload airplane-mode tetap buka editor + unduh PDF', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()
  await showPreview(page)

  const swReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'no-sw-api'
    try {
      await navigator.serviceWorker.ready
      return 'ready'
    } catch {
      return 'not-ready'
    }
  })
  expect(swReady).toBe('ready')

  await page.waitForTimeout(1500)
  await context.setOffline(true)
  try {
    // `page.reload()` offline ditolak Playwright (ERR_INTERNET_DISCONNECTED);
    // `goto` memakai jalur navigasi yang sama dan dilayani SW dari cache.
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()
    await showPreview(page)

    const downloadPromise = page.waitForEvent('download')
    await page.locator('[data-probe="download-pdf"]:visible').first().click()
    const download = await downloadPromise
    const file = await download.path()
    expect(file).toBeTruthy()
  } finally {
    await context.setOffline(false)
  }
})

test('offline penuh: isi → ganti template → periksa ATS → download PDF', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  // Kunjungan pertama ONLINE: service worker memasang cache app shell + font.
  await page.goto('/')
  await showPreview(page)
  await dismissFirstRun(page)
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready
  })
  await page.waitForTimeout(1500)

  // ---- "Airplane mode": tidak ada request yang boleh lolos ----
  const requests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith('http://') || url.startsWith('https://')) requests.push(url)
  })
  await context.setOffline(true)

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible({
      timeout: 15_000,
    })
    await showPreview(page)

    // 1) ISI CV — profile + bullet pengalaman lewat form nyata.
    const formTab = page.getByRole('tab', { name: 'Isi data' })
    if (await formTab.isVisible().catch(() => false)) await formTab.click()
    const rail = page.locator('aside[aria-label="Bagian"] nav')
    if (await rail.isVisible().catch(() => false)) {
      await rail.getByRole('button').filter({ hasText: 'Profil' }).first().click()
    } else {
      await page.getByRole('button', { name: 'Bagian' }).click()
      await page
        .getByRole('dialog')
        .getByRole('button')
        .filter({ hasText: 'Profil' })
        .first()
        .click()
    }
    await expect(page.locator('#profile-fullName')).toBeVisible({ timeout: 10_000 })
    await page.locator('#profile-fullName').fill('Zeta Offline')
    await page.locator('#profile-email').fill('zeta@offline.id')

    await showPreview(page)
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toContainText(
      'Zeta Offline',
    )

    // 2) GANTI TEMPLATE — Ledger, tanpa server.
    const trigger = page.locator('[data-probe="template-trigger"]')
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click()
    } else {
      await page.getByRole('button', { name: 'Menu' }).click()
    }
    const ledger = page.getByRole('dialog').locator('button').filter({ hasText: 'Ledger' }).first()
    await expect(ledger).toBeVisible()
    await ledger.click()
    await expect(page.getByText('Template Ledger dipakai')).toBeVisible()

    // 3) PERIKSA ATS — drawer + skor + disclaimer, semua lokal.
    const checkButton = page.locator(
      '[data-probe="check-ats"]:visible, [data-probe="check-ats-mobile"]:visible',
    )
    await checkButton.first().click()
    const drawer = page.locator('[data-probe="ats-drawer"]')
    await expect(drawer).toBeVisible()
    const runButton = drawer.locator('[data-probe="ats-check-now"]')
    if (await runButton.isVisible().catch(() => false)) await runButton.click()
    await expect(drawer.locator('[data-probe="ats-score-value"]')).toBeVisible({ timeout: 15_000 })
    await expect(drawer.locator('[data-probe="ats-disclaimer"]')).toBeVisible()
    const score = await drawer.locator('[data-probe="ats-score-value"]').innerText()
    expect(score.trim()).toMatch(/^\d+$/)

    // Parse tape juga lokal.
    await drawer.locator('[data-probe="ats-tab-tape"]').click()
    await expect(drawer.locator('[data-probe="ats-tape"]')).toContainText('NAME')

    // 4) DOWNLOAD PDF — berkas nyata, teks berbasis PDF.
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 })
    await page.keyboard.press('Escape')
    await page.locator('[data-probe="download-pdf"]:visible').first().click()
    const download = await downloadPromise
    const file = await download.path()
    expect(file).toBeTruthy()

    mkdirSync(ARTIFACT_DIR, { recursive: true })
    const saved = path.join(ARTIFACT_DIR, 'offline-zeta-ledger.pdf')
    const bytes = readFileSync(file!)
    writeFileSync(saved, bytes)
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.length).toBeGreaterThan(20_000)

    // Nama berkas & template mengikuti dokumen offline.
    expect(download.suggestedFilename()).toBe('zeta-offline-ledger.pdf')

    // Tidak ada request keluar selama mode offline (hanya navigasi yang
    // dilayani service worker dari cache).
    const escaped = requests.filter((url) => !url.startsWith('http://localhost:4199'))
    expect(escaped).toEqual([])
    expect(errors).toEqual([])
  } finally {
    await context.setOffline(false)
  }
})
