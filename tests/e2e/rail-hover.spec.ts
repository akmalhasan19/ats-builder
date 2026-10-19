/**
 * rail-hover.spec.ts — tombol aksi di rail tidak boleh tertimpa nama bagian
 *
 * Nama bagian bisa panjang (mis. "Sertifikasi", atau label kustom nanti),
 * sedangkan empat ikon aksi butuh ruang sendiri di kanan baris. Dua hal
 * diuji di sini:
 *
 * 1. saat baris disorot, nama bagian memudar dan tidak menutupi ikon aksi;
 * 2. ikon aksi tetap bisa diklik (menu "Tindakan bagian" terbuka).
 */
import { expect, test, type Page } from '@playwright/test'

const railRow = (page: Page, index: number) =>
  page.locator('aside[aria-label="Bagian"] nav > div').nth(index)

test.describe('rail — hover baris bagian', () => {
  test('nama bagian memudar dan tombol aksi tidak tertimpa nama', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10_000 })

    const row = railRow(page, 2)
    const name = row.locator('span.text-rail-label').first()
    const actions = row.getByRole('button', { name: 'Tindakan bagian' })

    // Sebelum hover: nama tampil penuh.
    await expect(name).toHaveCSS('opacity', '1')

    await row.hover()

    // Nama memudar → tidak ada lagi yang menutupi ikon aksi.
    await expect(name).toHaveCSS('opacity', '0')
    await expect(actions).toHaveCSS('opacity', '1')

    const nameBox = (await name.boundingBox())!
    const actionsBox = (await actions.boundingBox())!
    expect(
      actionsBox.x,
      'tombol aksi harus di sebelah kanan nama bagian, bukan di atasnya',
    ).toBeGreaterThanOrEqual(nameBox.x + nameBox.width - 1)

    await page.screenshot({
      path: 'artifacts/rail/rail-hover-1440.png',
      clip: { x: 0, y: 80, width: 380, height: 420 },
    })
  })

  test('tombol aksi tetap bisa diklik saat nama bagian panjang', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10_000 })

    const row = railRow(page, 2)
    await row.hover()

    await row.getByRole('button', { name: 'Tindakan bagian' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Sembunyikan' })).toBeVisible()
  })
})
