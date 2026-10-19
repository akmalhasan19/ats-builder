import { expect, test } from '@playwright/test'

test('offline: reload airplane-mode tetap buka editor + unduh PDF', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()

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
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page
      .getByRole('button', { name: /Unduh PDF|Download PDF/ })
      .first()
      .click()
    const download = await downloadPromise
    const path = await download.path()
    expect(path).toBeTruthy()
  } finally {
    await context.setOffline(false)
  }
})
