import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-ats.spec.ts — FASE 12 / C5.2
 *
 * `Perbaiki →` di drawer ATS saat mode kanvas: field target dibuka **di atas
 * kertas** (sesi edit yang sama dengan klik segmen), bukan di form. Field yang
 * tidak punya segmen di kertas (mis. tanggal pendidikan) tetap jatuh ke form
 * seperti perilaku T7.4 — tidak ada field yang jadi tidak bisa diperbaiki.
 */

const dismissFirstRun = async (page: Page): Promise<void> => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', { name: /Nanti saja/ })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
  }
}

const toCanvasMode = async (page: Page): Promise<void> => {
  await page.locator('[data-probe="tampilan-menu"]').click()
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  await page.keyboard.press('Escape')
}

const runCheck = async (page: Page) => {
  await page.locator('[data-probe="check-ats"]').click()
  const drawer = page.locator('[data-probe="ats-drawer"]')
  await expect(drawer).toBeVisible()
  await page.locator('[data-probe="ats-check-now"]').click()
  await expect(drawer.locator('[data-probe="ats-score-value"]')).toBeVisible({ timeout: 10_000 })
  return drawer
}

test.describe('Perbaiki → di mode kanvas (C5.2)', () => {
  test('isu tanggal membuka editor tanggal di atas kertas dan commit menulis dokumen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    await dismissFirstRun(page)
    await toCanvasMode(page)

    // Entri pengalaman baru tanpa tanggal → isu `dates.missing` yang targetnya
    // presisi (entri + field tanggal). Ghost row membuka sesi; batalkan edit
    // field pertama supaya entri tetap kosong.
    await page.locator('[data-probe="canvas-ghost-entry"]').first().click()
    await expect(page.locator('.canvas-editor').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.canvas-editor')).toHaveCount(0)

    const drawer = await runCheck(page)
    const issue = drawer
      .locator('[data-probe="ats-issue"]')
      .filter({ hasText: 'Tanggal mulai belum diisi' })
    await expect(issue).toHaveCount(1)

    await issue.locator('[data-probe="ats-fix"]').click()

    // Bukti utama: editor tanggal hidup di atas kertas, blok bersesi ditandai.
    const dates = page.locator('[data-probe="canvas-dates"]')
    await expect(dates).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-canvas-editing="true"]')).toHaveCount(1)
    // Fokus pindah ke kontrol (D11) — bukan tertinggal di tombol drawer.
    await expect
      .poll(async () =>
        page.evaluate(
          () => document.activeElement?.closest('[data-probe="canvas-dates"]') !== null,
        ),
      )
      .toBe(true)

    const months = dates.locator('input[type="month"]')
    await months.first().fill('2023-03')
    await dates.getByRole('button', { name: 'Simpan' }).click()
    await expect(dates).toHaveCount(0)

    const segment = page
      .locator('#pane-preview [data-field^="entries.experience"][data-field$=".dates"]')
      .last()
    await expect(segment).toContainText('Mar 2023')
  })

  test('field di luar matriks kanvas (tanggal pendidikan) tetap diperbaiki di form', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10_000 })
    await dismissFirstRun(page)

    // Kosongkan tanggal selesai pendidikan lewat form.
    await page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Pendidikan' })
      .first()
      .click()
    const endDate = page.locator('#pane-form input[id^="edu-"][id$="-dates-end"]').first()
    await expect(endDate).toBeVisible()
    await endDate.fill('')
    await expect(endDate).toHaveValue('')

    await toCanvasMode(page)
    const drawer = await runCheck(page)
    const issue = drawer
      .locator('[data-probe="ats-issue"]')
      .filter({ hasText: 'Tanggal selesai belum diisi' })
    await expect(issue).toHaveCount(1)

    await issue.locator('[data-probe="ats-fix"]').click()

    // Fallback: tidak ada sesi kanvas, dan field form yang sama terfokus.
    await expect(page.locator('[data-canvas-editing="true"]')).toHaveCount(0)
    await expect(page.locator('[data-probe="canvas-dates"]')).toHaveCount(0)
    await expect(endDate).toBeFocused()
  })
})
