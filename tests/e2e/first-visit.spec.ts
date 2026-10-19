/**
 * first-visit.spec.ts — T9.2
 *
 * Janji produk P1: viewport pertama adalah tool yang hidup, tanpa login wall
 * dan tanpa hero marketing. FirstRunCard hanya muncul pada kunjungan pertama
 * dan pilihannya tersimpan di perangkat.
 */
import { expect, test, type Page } from '@playwright/test'

const sheetOf = (page: Page) => page.locator('#pane-preview [data-probe="page-sheet"]').first()

test.describe('first-visit — T9.2', () => {
  test('kunjungan pertama: FirstRunCard → contoh CV → lembar A4 terisi → tidak muncul lagi', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const card = page.getByRole('radiogroup')
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card).toHaveAccessibleName('MULAI DARI MANA?')
    await expect(page.getByRole('radio', { name: /Pakai contoh CV/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await expect(page.getByRole('radio', { name: /Mulai dari kosong/ })).toHaveAttribute(
      'aria-checked',
      'false',
    )

    await page.getByRole('button', { name: 'Lanjut' }).click()

    const sheet = sheetOf(page)
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('Alex Morgan')
    await expect(sheet).toContainText('alex.morgan@mail.com')
    await expect(page.getByText('Dokumen contoh siap diedit')).toBeVisible()

    // Preferensi ditulis ke IndexedDB → reload bukan kunjungan pertama lagi.
    await page.reload()
    await expect(page.getByRole('radiogroup')).toHaveCount(0)
    await expect(sheetOf(page)).toContainText('Alex Morgan')

    expect(errors).toEqual([])
  })

  test('pilihan "Mulai dari kosong" membuat dokumen bersih tanpa mengorbankan alur', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('radiogroup')).toBeVisible({ timeout: 10_000 })

    await page.getByRole('radio', { name: /Mulai dari kosong/ }).click()
    await page.getByRole('button', { name: 'Lanjut' }).click()

    await expect(page.getByText('Dokumen kosong dibuat')).toBeVisible()
    const sheet = sheetOf(page)
    await expect(sheet).toBeVisible()
    await expect(sheet).not.toContainText('Alex Morgan')

    // Dokumen kosong tetap bisa diperiksa & diunduh (P2, tanpa isi).
    await page.locator('[data-probe="check-ats"]').click()
    await expect(page.locator('[data-probe="ats-disclaimer"]')).toBeVisible()
    await page.keyboard.press('Escape')

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.locator('[data-probe="download-pdf"]:visible').first().click(),
    ])
    expect((await download.path()) ?? '').not.toBe('')
  })

  test('tanpa login wall: tidak ada pintu masuk di layar pertama & workspace langsung aktif', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()

    const firstScreen = await page.evaluate(() => {
      const fold = window.innerHeight
      const nodes = Array.from(document.querySelectorAll('header, main, [data-probe]'))
      const labels: string[] = []
      for (const node of nodes) {
        const rect = node.getBoundingClientRect()
        if (rect.top < fold && rect.height > 0) labels.push(node.tagName + ':' + node.className)
      }
      return labels.join('|')
    })
    expect(firstScreen).toContain('MAIN')

    await expect(page.getByRole('link', { name: /Masuk/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Daftar/ })).toHaveCount(0)
  })

  test('konten homepage mengalir DI BAWAH workspace, bukan menggantikannya', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('radiogroup')).toBeVisible({ timeout: 10_000 })

    const workspaceTop = await page
      .getByRole('main', { name: 'Ruang kerja CV' })
      .evaluate((el) => el.getBoundingClientRect().top)
    expect(workspaceTop).toBeLessThan(200)

    const anchor = page.locator('[data-probe="home-anchor"]')
    await expect(anchor).toBeVisible()
    await anchor.click()
    await expect(
      page.getByRole('heading', { name: 'Lima template, satu aturan: satu kolom.' }),
    ).toBeVisible()
  })
})
