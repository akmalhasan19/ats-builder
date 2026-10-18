import { expect, test } from '@playwright/test'

test('selisih layar vs spikeSpec berada dalam toleransi ±1 mm', async ({ page }) => {
  await page.goto('/dev/preview')
  const rows = page.locator('[data-probe="check-row"]')
  await expect(rows).toHaveCount(4)
  for (let i = 0; i < 4; i += 1) {
    await expect(rows.nth(i)).toHaveAttribute('data-pass', 'true')
  }
})

test('lembar A4 794×1123 diskalakan dengan kontainer ber-tinggi terkalkulasi', async ({ page }) => {
  await page.goto('/dev/preview')
  const sheet = page.locator('[data-probe="sheet"]')
  await expect(sheet).toHaveCSS('width', '794px')
  await expect(sheet).toHaveCSS('height', '1123px')
  // Chromium menormalkan `top center` jadi pasangan px pada kotak 794px
  await expect(sheet).toHaveCSS('transform-origin', /^(top center|397px 0px)$/)

  const measured = await page.evaluate(() => {
    const sheet = document.querySelector('[data-probe="sheet"]')
    const sizer = sheet?.parentElement
    if (!sizer) return null
    return {
      drawnWidth: (sheet as HTMLElement).getBoundingClientRect().width,
      drawnHeight: (sheet as HTMLElement).getBoundingClientRect().height,
      sizerWidth: sizer.getBoundingClientRect().width,
      sizerHeight: sizer.getBoundingClientRect().height,
    }
  })

  expect(measured).not.toBeNull()
  const scale = measured!.drawnWidth / 794
  expect(scale).toBeGreaterThan(0.29)
  expect(scale).toBeLessThan(1.51)
  // kontainer harus setinggi lembar hasil skala, bukan setinggi 1123px mentah
  expect(measured!.sizerHeight).toBeCloseTo(1123 * scale, 0)
  expect(measured!.sizerWidth).toBeCloseTo(794 * scale, 0)
})

test('PDF pembanding dibuat lewat chunk lazy lalu tampil', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const chunkRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('spikePdf')) chunkRequests.push(request.url())
  })

  await page.goto('/dev/preview')
  await page.waitForSelector('[data-probe="sheet"]')
  expect(chunkRequests, 'chunk PDF tidak boleh dimuat sebelum diminta').toHaveLength(0)

  await page.getByRole('button', { name: /Muat PDF/i }).click()
  await expect(page.locator('iframe')).toBeVisible({ timeout: 30_000 })
  expect(chunkRequests.length, 'chunk PDF dimuat saat tombol diklik').toBeGreaterThan(0)

  // tata letak berubah setelah PDF tampil — pengukuran harus tetap dalam toleransi
  const rows = page.locator('[data-probe="check-row"]')
  await expect(rows).toHaveCount(4)
  for (let i = 0; i < 4; i += 1) {
    await expect(rows.nth(i)).toHaveAttribute('data-pass', 'true')
  }

  await page.screenshot({ path: 'artifacts/dev-preview-1440.png', fullPage: true })
})
