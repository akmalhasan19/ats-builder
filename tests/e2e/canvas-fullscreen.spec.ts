import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-fullscreen.spec.ts — FASE 13 / Gate Fase 3 & Fase 6 (T6.4)
 *
 * Membuktikan tiga hal yang menjadi alasan fase ini ada:
 *  1. masuk layar penuh lalu keluar lewat tombol → rail & formulir kembali,
 *     `editMode` tetap 'canvas' (D2, D6);
 *  2. preferensi `canvasFullscreen` bertahan lintas reload (T3.1);
 *  3. kontrol struktural yang hilang bersama rail dapat diakses lagi lewat
 *     menu "Bagian" di toolbar kanvas (T3.4, D12), dan drawer ATS menjadi
 *     lapisan walau ≥1600px (T3.5, D9).
 *
 * FASE 13 / T6.4 — alur inti layar penuh yang di luar cakupan Gate Fase 3:
 * skala kertas benar-benar membesar (> 1,5 di 1440px, bukan mentok), editor
 * swap-in Fase 12 tetap hidup tanpa rail, dan ghost row tetap bisa menambah
 * entri dari kertas.
 */

const rail = (page: Page) => page.locator('aside[aria-label="Bagian"]')
const form = (page: Page) => page.locator('#pane-form')
const preview = (page: Page) => page.locator('#pane-preview')

/** Lebar yang benar-benar tersedia untuk grid (scrollbar tidak ikut dihitung). */
const clientWidth = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.clientWidth)

const dismissFirstRun = async (page: Page): Promise<void> => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', { name: /Nanti saja/ })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
  }
}

/** Mode kanvas lewat menu Tampilan — jalur yang sebenarnya dipakai pengguna. */
const toCanvasMode = async (page: Page): Promise<void> => {
  await page.locator('[data-probe="tampilan-menu"]').click()
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  await page.keyboard.press('Escape')
}

const setup = async (page: Page, width = 1440, height = 900): Promise<void> => {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await expect(form(page)).toBeVisible({ timeout: 10_000 })
  await dismissFirstRun(page)
}

test.describe('kertas layar penuh — jalan keluar & kontrol', () => {
  test('keluar lewat tombol mengembalikan rail & formulir tanpa mengubah mode', async ({
    page,
  }) => {
    await setup(page)
    await toCanvasMode(page)

    // Satu pane: rail & formulir disembunyikan, pratinjau memenuhi workspace.
    await expect(rail(page)).toBeHidden()
    await expect(form(page)).toBeHidden()
    const available = await clientWidth(page)
    const box = await preview(page).boundingBox()
    expect(box?.width).toBe(available)
    await page.screenshot({ path: 'artifacts/fase13-f3/masuk-layar-penuh-1440.png' })

    const exit = page.locator('[data-probe="canvas-exit"]')
    await expect(exit).toBeVisible()
    await exit.click()

    // Kembali berpanel — dan tetap di mode "Langsung di CV".
    await expect(rail(page)).toBeVisible()
    await expect(form(page)).toBeVisible()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
    await expect(exit).toHaveCount(0)
    // Panel formulir hidup lagi: field benar-benar bisa diisi.
    await expect(page.locator('#profile-fullName')).toBeEditable()

    await page.screenshot({ path: 'artifacts/fase13-f3/keluar-tombol-1440.png' })
  })

  test('preferensi layar penuh yang dimatikan bertahan setelah reload', async ({ page }) => {
    await setup(page)
    await toCanvasMode(page)

    await page.locator('[data-probe="tampilan-menu"]').click()
    const toggle = page.getByRole('switch', { name: 'Kertas layar penuh' })
    await expect(toggle).toBeEnabled()
    await toggle.click()
    await page.keyboard.press('Escape')

    await expect(rail(page)).toBeVisible()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')

    await page.reload()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
    await expect(rail(page)).toBeVisible()
    await expect(form(page)).toBeVisible()

    // Nyalakan lagi → layar penuh, dan itu yang tersimpan di `ats:prefs:v1`.
    await page.locator('[data-probe="tampilan-menu"]').click()
    await page.getByRole('switch', { name: 'Kertas layar penuh' }).click()
    await page.keyboard.press('Escape')
    await expect(rail(page)).toBeHidden()

    await page.reload()
    await expect(rail(page)).toBeHidden()
    await expect(form(page)).toBeHidden()
  })

  test('toggle mati selama mode form agar tidak membingungkan', async ({ page }) => {
    await setup(page)
    await page.locator('[data-probe="tampilan-menu"]').click()
    await expect(page.getByRole('switch', { name: 'Kertas layar penuh' })).toBeDisabled()
  })

  test('menu "Bagian" mengembalikan kontrol struktural rail', async ({ page }) => {
    await setup(page)
    const railOrderBefore = await rail(page).innerText()

    await toCanvasMode(page)
    const menu = page.locator('[data-probe="canvas-sections-menu"]')
    await expect(menu).toBeVisible()
    await menu.click()

    const popover = page.locator('[data-slot="popover-content"]')
    await expect(popover).toBeVisible()

    // Sembunyikan bagian: bloknya hilang dari kertas.
    const blocksBefore = await page.locator('[data-probe="preview-block"]').count()
    await popover.getByRole('checkbox').nth(1).click()
    await expect
      .poll(async () => page.locator('[data-probe="preview-block"]').count(), {
        message: 'blok bagian kedua tidak hilang dari kertas',
      })
      .toBeLessThan(blocksBefore)

    // Ubah urutan bagian pertama.
    await popover
      .getByRole('button', { name: /^Pindahkan ke bawah/ })
      .first()
      .click()
    await page.screenshot({ path: 'artifacts/fase13-f3/menu-bagian-popover-1440.png' })

    await page.keyboard.press('Escape')
    await page.locator('[data-probe="canvas-exit"]').click()
    await expect(rail(page)).toBeVisible()
    // Urutan di rail = urutan dokumen: kontrol kanvas benar-benar menulisnya.
    expect(await rail(page).innerText()).not.toBe(railOrderBefore)

    await page.screenshot({ path: 'artifacts/fase13-f3/menu-bagian-1440.png' })
  })

  test('ATS menjadi lapisan di 1680px, kertas tetap satu pane', async ({ page }) => {
    await setup(page, 1680, 950)
    await toCanvasMode(page)
    await expect(rail(page)).toBeHidden()

    await page.locator('[data-probe="check-ats"]').click()
    const drawer = page.locator('[data-probe="ats-drawer"]')
    await expect(drawer).toBeVisible()

    // Bukan kolom ke-4: drawer berbentuk dialog yang menimpa dari sisi kanan.
    await expect(drawer).toHaveAttribute('role', 'dialog')
    const available = await clientWidth(page)
    const box = await preview(page).boundingBox()
    expect(box?.width).toBe(available)
    // Tidak ada scroll horizontal walau drawer terbuka di atas kertas.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0)

    await page.screenshot({ path: 'artifacts/fase13-f3/ats-overlay-1680.png' })

    // Keluar layar penuh dengan ATS masih terbuka → kembali menjadi kolom ke-4.
    await page.locator('[data-probe="canvas-exit"]').click()
    await expect(rail(page)).toBeVisible()
    await expect(drawer).toHaveJSProperty('tagName', 'ASIDE')
    await expect(drawer).toBeVisible()
    // Lembar tetap terlihat di sebelah kolom ATS — tidak ada flash layout.
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0)
  })
})

/**
 * T6.4 — alur inti layar penuh. Selektor sengaja menyalin pola spec Fase 12
 * (`canvas-edit`/`canvas-entry`) supaya yang dibuktikan di sini benar-benar
 * jalur "satu pane", bukan salinan tes panel.
 */
test.describe('T6.4 — alur inti mode kanvas layar penuh', () => {
  test('skala kertas lewat dari 1,5 di 1440px — kertas benar-benar membesar', async ({ page }) => {
    await setup(page, 1440, 900)
    await toCanvasMode(page)

    // Fit mode kanvas: (1440 − 80 padding) / 794 × 794 = 1360px (anchor T0.2
    // bagian D). 1,5 × 794 = 1191px adalah plafon mode form — "mentok" yang
    // membuat layar penuh terasa seperti ruang kosong (§1.2).
    const sheet = page.locator('#pane-preview [data-probe="page-sheet"]').first()
    await expect(sheet).toBeVisible()
    const sheetWidth = async () => (await sheet.boundingBox())?.width ?? 0
    await expect
      .poll(sheetWidth, { message: 'kertas tidak pernah melewati plafon mode form 1,5' })
      .toBeGreaterThan(1191)
    expect(await sheetWidth()).toBeGreaterThanOrEqual(1350)

    // Kertas memenuhi lebar yang tersedia — bukan cuma ruang kosong bertambah.
    const available = await clientWidth(page)
    const box = await preview(page).boundingBox()
    expect(box?.width).toBe(available)

    await page.screenshot({ path: 'artifacts/fase13-f6/skala-kertas-1440.png' })
  })

  test('klik teks di kertas tetap membuka editor swap-in dan bisa diketik', async ({ page }) => {
    await setup(page)
    await toCanvasMode(page)
    // Tanpa rail & formulir (regresi Fase 12 yang wajib tetap hidup).
    await expect(rail(page)).toBeHidden()
    await expect(form(page)).toBeHidden()

    await page.locator('#pane-preview [data-field="profile.fullName"]').click()
    const editor = page.locator('#pane-preview .canvas-editor')
    await expect(editor).toBeVisible()
    await expect(editor).toBeFocused()
    await expect(editor).toHaveValue('Alex Morgan')

    await editor.fill('Budi Santoso')
    await editor.press('Enter')
    await expect(page.locator('#pane-preview [data-field="profile.fullName"]')).toHaveText(
      'Budi Santoso',
    )
  })

  test('ghost row "+ Tambahkan entri" tetap berfungsi tanpa rail', async ({ page }) => {
    await setup(page)
    await toCanvasMode(page)

    await page.locator('#pane-preview [data-canvas-ghost="entry"]').first().click()
    const editor = page.locator('#pane-preview .canvas-editor')
    await expect(editor).toBeVisible()
    await editor.fill('Platform Engineer')
    await editor.press('Enter')

    // Entri baru muncul di kertas — jalur "tambah konten" (D10) yang mengganti
    // rail tetap hidup di layar penuh.
    await expect(page.locator('#pane-preview').getByText('Platform Engineer')).toBeVisible()
    await expect(editor).toHaveCount(0)
  })
})
