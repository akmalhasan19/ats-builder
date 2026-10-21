import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-mobile.spec.ts — FASE 12 / C5.1 (§5.3)
 *
 * Kanvas yang usable di Pixel 7 (project mobile-chrome):
 *  - badge tab Pratinjau saat mode kanvas aktif (D2);
 *  - target sentuh: area hit segmen ≥32px, ghost row 44px;
 *  - editor tanggal sebagai Sheet bawah (pola sticky action bar), bukan
 *    popover melayang — kontrol & probe sama dengan desktop;
 *  - menu Tampilan = entri di sheet MobileMenu.
 */

const startApp = async (page: Page): Promise<void> => {
  await page.goto('/')
  await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await page.getByRole('tab', { name: /Pratinjau/ }).click()
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
    timeout: 10_000,
  })
}

const toCanvasMode = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  await page.keyboard.press('Escape')
}

test.describe('kanvas mobile (C5.1, §5.3)', () => {
  test('mode kanvas: tab Pratinjau mendapat badge dengan nama aksesibel yang tetap berlabel', async ({
    page,
  }) => {
    await startApp(page)

    const tablist = page.getByRole('tablist', { name: 'Mode tampilan' })
    await expect(tablist).toBeVisible()
    await expect(page.locator('[data-probe="mobile-badge-canvas"]')).toHaveCount(0)

    await toCanvasMode(page)

    const tab = page.getByRole('tab', { name: /Pratinjau/ })
    // Titik berbadge hanya dekoratif (aria-hidden); label "Pratinjau" tetap
    // terlihat DAN nama aksesibel memuatnya (aturan "label in name").
    const badge = page.locator('[data-probe="mobile-badge-canvas"]')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveAttribute('aria-hidden', 'true')
    await expect(tab).toHaveAttribute('aria-label', 'Pratinjau (mode kanvas aktif)')

    // Menutup mode kanvas menghilangkan badge.
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.locator('[data-probe="edit-mode-form"]').click()
    await page.keyboard.press('Escape')
    await expect(badge).toHaveCount(0)
  })

  test('target sentuh: segmen ≥32px dan ghost row 44px (ruang kertas)', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Kertas diproyeksikan dengan transform scale (fit mode default, D2) —
    // nilai 32/44 §5.3 adalah ukuran pada RUANG KERTAS (zoom 100%), jadi
    // pengukuran dibagi skala paper sekarang.
    const paperScale = await page.locator('[data-probe="preview-content"]').evaluate((el) => {
      const style = getComputedStyle(el)
      return style.transform && style.transform !== 'none'
        ? Math.abs(new DOMMatrix(style.transform).a)
        : 1
    })
    expect(paperScale).toBeGreaterThan(0)

    // Tidak ada klik segmen di sini supaya zoom tetap pada skala awal (D7
    // hanya naik saat interaksi; pengukuran tetap netral terhadap D7).
    const segments = await page
      .locator('#pane-preview [data-canvas-field]')
      .evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          return {
            height: rect.height,
            paddingY: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
          }
        }),
      )
    expect(segments.length, 'dokumen contoh punya segmen kanvas').toBeGreaterThan(0)
    for (const { height, paddingY } of segments) {
      // Area hit ≥32px: padding transparan melebar tanpa mengubah tinggi baris
      // teks (tombol inline non-replaced), jadi pagination kertas tak berubah.
      // (pembulatan 2 desimal menghilangkan noise float dari pembagian skala.)
      const paperHeight = Math.round((height / paperScale) * 100) / 100
      expect(paperHeight, 'area hit segmen (ruang kertas)').toBeGreaterThanOrEqual(32)
      expect(paddingY, 'padding transparan §5.3').toBeGreaterThanOrEqual(20)
    }

    const ghosts = await page
      .locator('#pane-preview [data-canvas-ghost]')
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height))
    expect(ghosts.length, 'ghost row tersedia di dokumen contoh').toBeGreaterThan(0)
    for (const height of ghosts) {
      expect(
        Math.round((height / paperScale) * 100) / 100,
        'ghost row target sentuh',
      ).toBeGreaterThanOrEqual(44)
    }
  })

  test('editor tanggal terbuka sebagai Sheet bawah dan commit lewat Simpan', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Ambil ENTRI TERAKHIR yang tanggalnya sudah selesai (bukan "SEKARANG"),
    // supaya kedua input bulan bisa diisi.
    await page
      .locator('#pane-preview [data-field^="entries.experience"][data-field$=".dates"]')
      .last()
      .click()

    const panel = page.locator('[data-probe="canvas-dates"]')
    await expect(panel).toBeVisible()
    // Varian mobile = Sheet bawah (bukan popover melayang).
    await expect(panel).toHaveAttribute('data-side', 'bottom')

    const months = panel.locator('input[type="month"]')
    await expect(months.first()).toBeVisible()
    await expect(months.nth(1)).toBeEnabled()
    await months.nth(0).fill('2018-07')
    await months.nth(1).fill('2024-05')
    await panel.getByRole('button', { name: 'Simpan' }).click()

    await expect(panel).toHaveCount(0)
    await expect(
      page.locator('#pane-preview [data-field^="entries.experience"][data-field$=".dates"]').last(),
    ).toContainText('Jul 2018')
  })

  test('menu Tampilan mobile: mode kanvas, toggle pratinjau, dan preset zoom dalam satu sheet', async ({
    page,
  }) => {
    await startApp(page)

    await page.getByRole('button', { name: 'Menu' }).click()
    const sheetBody = page.locator('[data-slot="sheet-content"]')

    // Mode pengerjaan (D2) — radiogroup probe yang sama dengan popover desktop.
    const group = page.locator('[data-probe="edit-mode"]:visible')
    await expect(group).toBeVisible()
    await expect(group.locator('[data-probe="edit-mode-canvas"]')).toBeVisible()
    await sheetBody.locator('[data-probe="edit-mode-canvas"]').click()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')

    // Toggle pratinjau & preset zoom ikut tersedia (isi TampilanMenuContent).
    await expect(sheetBody.getByRole('switch').first()).toBeVisible()
    await expect(sheetBody.getByRole('radio', { name: '50%' })).toBeAttached()
    await expect(sheetBody.getByRole('radio', { name: '100%' })).toBeAttached()

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-probe="mobile-badge-canvas"]')).toBeVisible()
  })
})
