import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-edit-zoom.spec.ts — addendum FASE 13 — **zoom edit di layar sempit**.
 *
 * Di layar sempit (panel mode `tabs`, <1024px) kertas A4 selalu lebih lebar
 * daripada layar, jadi mengedit field di atas kertas tanpa perubahan apa pun
 * berarti mengetik di teks setinggi ±4px. Perilaku yang diuji:
 *
 *  1. menyentuh field → skala naik ke **75%**;
 *  2. tepi kiri **kertas** masih punya ruang di kiri layar (Addendum FASE 14
 *     — tidak menempel/dipotong di tepi), dan field yang disentuh tetap
 *     terlihat di area yang sama; toolbar (nilai zoom, "Tampilan", "Keluar")
 *     juga tetap terlihat;
 *  3. edit selesai (commit) atau dibatalkan (Escape) → skala **kembali** ke
 *     zoom ringkasan yang tadi dipakai.
 *
 * Spec ini khusus mobile: desktop memakai guard lama (D7) yang menaikkan zoom
 * sekali saja per sesi aplikasi dan **tidak** mengembalikannya.
 */

/**
 * Padding well `p-6` (24px) — jarak minimum tepi kiri kertas dari tepi kiri
 * konten well saat sesi edit. Cerminan `FOCUS_EDGE_MARGIN_PX` di
 * `src/features/canvas/canvasEditZoom.ts`. Disalin literal supaya spec e2e
 * tidak menarik modul aplikasi ke runner.
 */
const FOCUS_EDGE_MARGIN_PX = 24

/** Lebar minimum tepi kiri field yang harus tetap terlihat. */
const FIELD_VISIBLE_MIN_PX = 80

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

/**
 * Template Executive: nama rata tengah — sama seperti template yang dipakai
 * pengguna pada tangkapan layar, dan satu-satunya yang nama besarnya berada
 * di tengah kertas (hanya bagian tengah yang bisa dipusatkan di layar sempit).
 */
const useExecutiveTemplate = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('dialog').locator('button').filter({ hasText: 'Executive' }).first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-probe="template-trigger"]')).toContainText('Executive')
}

/** Skala yang benar-benar dipakai pohon pratinjau. */
const scaleOf = (page: Page) =>
  page.evaluate(() => {
    const content = document.querySelector('[data-probe="preview-content"]')
    if (!content) return 1
    const match = /^matrix\(([^,]+)/.exec(getComputedStyle(content).transform)
    return match ? Number(match[1]) : 1
  })

/** Persentase zoom yang tampil di toolbar. */
const zoomLabel = (page: Page) => page.locator('[data-probe="zoom-value"]').innerText()

/**
 * Koordinat kertas (tanpa skala) dari **tepi kiri** sebuah segmen — dasar
 * untuk memeriksa bahwa teks yang disentuh berakhir di margin kiri well.
 */
const paperLeftOf = async (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const element = document.querySelector(sel)
    const content = document.querySelector('[data-probe="preview-content"]')
    if (!element || !content) return null
    const scale = new DOMMatrix(getComputedStyle(content).transform).a || 1
    const rect = element.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    return { x: (rect.left - contentRect.left) / scale }
  }, selector)

/** Tepi kiri area konten well (bukan border box). */
const wellLeft = (page: Page) =>
  page.evaluate(() => {
    const well = document.querySelector('#pane-preview')
    if (!well) return null
    const rect = well.getBoundingClientRect()
    const borderLeft = Number.parseFloat(getComputedStyle(well).borderLeftWidth) || 0
    return rect.left + borderLeft
  })

/** Set zoom ke angka pasti (bukan "Fit") lewat tombol Perkecil. */
const setZoomPercent = async (page: Page, percent: number): Promise<void> => {
  await page.locator('[data-probe="zoom-value"]').click()
  await page
    .locator('[data-slot="popover-content"]')
    .getByRole('button', { name: '50%', exact: true })
    .click()
  await page.keyboard.press('Escape')
  // 50% → target lewat tombol Perkecil (langkah 10%).
  const steps = (50 - percent) / 10
  for (let index = 0; index < steps; index += 1) {
    await page.getByRole('button', { name: 'Perkecil' }).click()
  }
  await expect.poll(() => zoomLabel(page)).toBe(`${percent}%`)
}

test.describe('zoom edit di layar sempit (addendum FASE 13)', () => {
  test('sentuh field → skala 75%, kertas punya ruang kiri, field terlihat; selesai → kembali 30%', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)
    await useExecutiveTemplate(page)

    // Zoom ringkasan 30% — kondisi nyata di layar kecil (kertas A4 tak pernah
    // muat, jadi user zoom keluar sendiri supaya melihat seluruh halaman).
    await setZoomPercent(page, 30)
    expect(await scaleOf(page)).toBeCloseTo(0.3, 2)

    const name = page.locator('#pane-preview [data-field="profile.fullName"]')
    const paper = await paperLeftOf(page, '#pane-preview [data-field="profile.fullName"]')
    expect(paper).not.toBeNull()

    await name.click()

    // 1. Skala naik ke 75% supaya teksnya enak diketik.
    await expect
      .poll(() => scaleOf(page), { message: 'skala tidak naik ke 75%' })
      .toBeCloseTo(0.75, 2)
    await expect(page.locator('#pane-preview .canvas-editor')).toBeVisible()

    // 2. Addendum FASE 14 — tepi kiri KERTAS masih punya ruang di kiri
    //    layar (tidak menempel/dipotong di tepi), dan field yang disentuh
    //    tetap terlihat di area yang sama.
    const left = await wellLeft(page)
    const landed = await page.evaluate((paperX) => {
      const content = document.querySelector('[data-probe="preview-content"]')
      if (!content) return null
      const scale = new DOMMatrix(getComputedStyle(content).transform).a || 1
      const contentRect = content.getBoundingClientRect()
      return { paperLeft: contentRect.left, fieldLeft: contentRect.left + paperX * scale }
    }, paper!.x)
    expect(landed).not.toBeNull()
    expect(
      landed!.paperLeft - left!,
      'tepi kiri kertas masih punya ruang di kiri layar',
    ).toBeGreaterThanOrEqual(FOCUS_EDGE_MARGIN_PX - 2)
    expect(landed!.fieldLeft - left!, 'field yang disentuh tetap terlihat').toBeLessThan(
      page.viewportSize()!.width - FIELD_VISIBLE_MIN_PX + 2,
    )

    // Toolbar tetap terlihat walau kertas bergeser horizontal — nilai zoom
    // dan jalan keluar dari mode kanvas tidak boleh ikut hilang.
    const toolbar = await page.locator('[data-probe="preview-toolbar"]').boundingBox()
    const viewport = page.viewportSize()
    expect(toolbar).not.toBeNull()
    expect(toolbar!.x).toBeGreaterThanOrEqual(0)
    expect(toolbar!.x + toolbar!.width).toBeLessThanOrEqual(viewport!.width)

    // 3. Selesai edit → zoom kembali ke ringkasan (30%).
    await page.locator('#pane-preview .canvas-editor').press('Enter')
    await expect(page.locator('#pane-preview .canvas-editor')).toHaveCount(0)
    await expect
      .poll(() => scaleOf(page), { message: 'zoom tidak kembali ke 30%' })
      .toBeCloseTo(0.3, 2)
    await expect.poll(() => zoomLabel(page)).toBe('30%')
  })

  test('batal (Escape) → zoom juga kembali ke ringkasan', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    await setZoomPercent(page, 30)

    await page.locator('#pane-preview [data-field="profile.fullName"]').click()
    await expect.poll(() => scaleOf(page)).toBeCloseTo(0.75, 2)

    await page.locator('#pane-preview .canvas-editor').press('Escape')
    await expect(page.locator('#pane-preview .canvas-editor')).toHaveCount(0)
    await expect
      .poll(() => scaleOf(page), { message: 'zoom tidak kembali ke 30%' })
      .toBeCloseTo(0.3, 2)
  })

  test('mode Fit juga dikembalikan (bukan hanya angka zoom)', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Kembali ke Fit — label toolbar menulis "Fit", bukan persentase.
    if ((await zoomLabel(page)) !== 'Fit') {
      await page.locator('[data-probe="zoom-value"]').click()
      await page
        .locator('[data-slot="popover-content"]')
        .getByRole('button', { name: 'Fit' })
        .click()
      await page.keyboard.press('Escape')
    }
    await expect.poll(() => zoomLabel(page)).toBe('Fit')
    const fit = await scaleOf(page)

    await page.locator('#pane-preview [data-field="profile.fullName"]').click()
    await expect.poll(() => scaleOf(page)).toBeCloseTo(0.75, 2)

    await page.locator('#pane-preview .canvas-editor').press('Enter')
    await expect.poll(() => scaleOf(page)).toBeCloseTo(fit, 2)
    await expect.poll(() => zoomLabel(page)).toBe('Fit')
  })
})
