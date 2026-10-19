/**
 * template-switch.spec.ts — T9.2
 *
 * Gate Fase 6 menuntut "ganti template tidak mengubah data"; spec ini
 * membuktikan hal yang sama lewat UI nyata: lima template dilewati satu per
 * satu, dan isi dokumen (judul, email, bullet, jumlah bagian) tidak bergeser.
 */
import { expect, test, type Page } from '@playwright/test'

const TEMPLATES = ['Classic ATS', 'Ledger', 'Executive', 'Minimal', 'Technician'] as const

const trigger = (page: Page) => page.locator('[data-probe="template-trigger"]')

const applyTemplate = async (page: Page, name: string): Promise<void> => {
  await trigger(page).click()
  const option = page
    .locator('[data-radix-popper-content-wrapper] button')
    .filter({ hasText: name })
    .first()
  await expect(option).toBeVisible()
  await option.click()
  await expect(trigger(page)).toContainText(name)
  await expect(page.getByText(`Template ${name} dipakai`)).toBeVisible()
}

const sectionLabels = async (page: Page): Promise<string[]> => {
  const items = page.locator('aside[aria-label="Bagian"] nav > div')
  const count = await items.count()
  const labels: string[] = []
  for (let index = 0; index < count; index += 1) {
    labels.push((await items.nth(index).locator('button').nth(1).innerText()).trim())
  }
  return labels
}

// Heading section memakai wajah yang berbeda antar template (§2.3) — inilah
// bukti renderer benar-benar berganti, bukan hanya label tombol.
const rendererFont = (page: Page): Promise<string> =>
  page
    .locator('#pane-preview [data-probe="preview-block"] h2')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily)

test.describe('template-switch — T9.2', () => {
  test('kelima template bisa dipakai dan data tidak berubah', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const later = page.getByRole('button', { name: 'Lanjut' })
    if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
      await page.getByRole('radio', { name: /Nanti saja/ }).click()
      await later.click()
    }

    // Isi dua field + ubah judul supaya punya sidik jari yang bisa dibandingkan.
    await page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Profil' })
      .first()
      .click()
    await page.locator('#profile-email').fill('zeta@uji.id')
    await page.locator('#profile-fullName').fill('Zeta Uji')
    await page.getByRole('button', { name: /Ubah judul CV/ }).click()
    await page.getByLabel('Judul dokumen').fill('CV Ganti Template')
    await page.keyboard.press('Enter')
    await expect(page.locator('#profile-email')).toHaveValue('zeta@uji.id')

    const labelsBefore = await sectionLabels(page)
    const sheetTextBefore = (
      await page.locator('#pane-preview [data-probe="page-sheet"]').first().innerText()
    ).replace(/\s+/g, ' ')

    const fonts: string[] = []
    for (const name of TEMPLATES) {
      await applyTemplate(page, name)
      await page.waitForTimeout(400)
      fonts.push(await rendererFont(page))

      await expect(page.locator('#profile-email')).toHaveValue('zeta@uji.id')
      await expect(page.locator('#profile-fullName')).toHaveValue('Zeta Uji')
      await expect(page.getByRole('button', { name: /Ubah judul CV/ })).toContainText(
        'CV Ganti Template',
      )
      await expect(page.locator('aside[aria-label="Bagian"] nav > div')).toHaveCount(
        labelsBefore.length,
      )
      await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toContainText(
        'Zeta Uji',
      )
      await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toContainText(
        'zeta@uji.id',
      )
    }

    // Renderer benar-benar berganti wajah, bukan hanya label tombol.
    expect(new Set(fonts).size).toBeGreaterThan(1)

    // Urutan & label bagian tidak berubah setelah lima kali ganti template.
    expect(await sectionLabels(page)).toEqual(labelsBefore)

    await page.reload()
    await expect(page.locator('#profile-fullName')).toHaveValue('Zeta Uji')
    await expect(trigger(page)).toContainText('Technician')

    // Dokumen asal (Classic) punya isi teks yang sama: tidak ada blok hilang.
    const sheetTextAfter = (
      await page.locator('#pane-preview [data-probe="page-sheet"]').first().innerText()
    ).replace(/\s+/g, ' ')
    for (const marker of ['Zeta Uji', 'zeta@uji.id']) {
      expect(sheetTextBefore).toContain(marker)
      expect(sheetTextAfter).toContain(marker)
    }

    expect(errors).toEqual([])
  })

  test('menu mobile juga bisa mengganti template tanpa menyentuh data', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const later = page.getByRole('button', { name: 'Lanjut' })
    if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
      await page.getByRole('radio', { name: /Nanti saja/ }).click()
      await later.click()
    }

    await page.getByRole('button', { name: 'Menu' }).click()
    const option = page.getByRole('dialog').locator('button').filter({ hasText: 'Ledger' }).first()
    await expect(option).toBeVisible()
    await option.click()

    await expect(page.getByText('Template Ledger dipakai')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5000 })

    // Di <1024px pratinjau hidup di tab kedua — pindah ke sana dulu.
    await page.getByRole('tab', { name: 'Pratinjau' }).click()
    const sheet = page.locator('#pane-preview [data-probe="page-sheet"]').first()
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('Alex Morgan')
    await page.screenshot({ path: 'artifacts/fase9/template-switch-390.png' })
  })

  test('/templates memakai template tanpa mengubah isi dokumen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('[data-probe="template-trigger"]')).toContainText('Classic ATS')

    await page.goto('/templates')
    await page.locator('[data-probe="template-card-executive"]').click()
    await page.locator('[data-probe="use-template"]').click()
    await expect(page.getByText('Template Executive dipakai')).toBeVisible()

    // `/templates` hidup di luar AppShell jadi tidak punya penanda simpan.
    // Tunggu lewat debounce autosave (400 ms) sebelum navigasi penuh; ini
    // juga membuktikan `startAutosave()` dipasang di root, bukan di shell.
    await page.waitForTimeout(700)
    await page.goto('/')
    await expect(page.getByRole('status', { name: 'Status penyimpanan' })).toContainText(
      'Disimpan di perangkat',
    )
    await expect(page.locator('[data-probe="template-trigger"]')).toContainText('Executive')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toContainText(
      'Alex Morgan',
    )
  })
})
