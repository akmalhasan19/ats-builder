/**
 * ats-checker.spec.ts — Gate Fase 7
 *
 * Skenario: buka drawer ATS, jalankan pemeriksaan, lalu klik `Perbaiki →`
 * pada isu email. Harus benar-benar memfokuskan field email di Form Pane —
 * bukan sekadar berpindah bagian.
 */
import { expect, test, type Page } from '@playwright/test'

const dismissFirstRun = async (page: Page): Promise<void> => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', { name: /Nanti saja/ })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
  }
}

const downloadSize = async (page: Page, withMarks: boolean): Promise<number> => {
  // Toggle stabilo-PDF hidup di dalam drawer, tombol unduh di top bar. Karena
  // drawer menutupi sisi kanan layar (1280–1599px), toggle dipakai dulu lalu
  // drawer ditutup sebelum menekan Download.
  const drawer = page.locator('[data-probe="ats-drawer"]')
  if (!(await drawer.isVisible())) {
    await page.locator('[data-probe="check-ats"]').click()
    await drawer.waitFor({ state: 'visible', timeout: 10000 })
  }
  const toggle = page.locator('[data-probe="ats-marks-in-pdf"]')
  const current = await toggle.isChecked()
  if (current !== withMarks) await toggle.setChecked(withMarks)

  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'hidden', timeout: 5000 })

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    // Tombol ada dua: top bar dan sticky bar mobile (yang tersembunyi di desktop).
    page.locator('[data-probe="download-pdf"]:visible').first().click(),
  ])
  const file = await download.path()
  if (!file) throw new Error('berkas unduhan tidak tersedia')
  const { statSync } = await import('node:fs')
  return statSync(file).size
}

const setProfileEmail = async (page: Page, value: string): Promise<void> => {
  const rail = page.locator('aside[aria-label="Bagian"] nav')
  await rail.getByRole('button').filter({ hasText: 'Profil' }).first().click()
  await page.locator('#profile-email').fill(value)
}

test.describe('ats-checker — Gate Fase 7', () => {
  test('Perbaiki → memfokuskan field email yang tepat', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10000 })
    await dismissFirstRun(page)

    // Email yang salah format → aturan `contact.email.invalid` (bad).
    await setProfileEmail(page, 'bukan-email')

    // Pindah ke bagian lain supaya fokus benar-benar berpindah.
    await page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Keahlian' })
      .first()
      .click()

    // Buka drawer & periksa.
    await page.locator('[data-probe="check-ats"]').click()
    await expect(page.locator('[data-probe="ats-drawer"]')).toBeVisible()
    await page.locator('[data-probe="ats-check-now"]').click()

    // Isu bad harus muncul, dan tombol Perbaiki pada isu itu benar ada.
    const drawer = page.locator('[data-probe="ats-drawer"]')
    const emailIssue = drawer
      .locator('[data-probe="ats-issue"]')
      .filter({ hasText: 'Format email tidak dikenali' })
    await expect(emailIssue).toBeVisible({ timeout: 10000 })

    await emailIssue.locator('[data-probe="ats-fix"]').click()

    // Bukti yang diminta Gate: field email benar-benar terfokus.
    await expect(page.locator('#profile-email')).toBeFocused()
    await expect(page.locator('#profile-email')).toHaveValue('bukan-email')

    // Bagian aktif ikut berpindah ke Profil (bukan Keahlian).
    await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible()

    // Disclaimer tetap terlihat (P5) dan badge isu bad muncul di tombol (T7.6).
    await expect(drawer.locator('[data-probe="ats-disclaimer"]')).toBeVisible()
    await expect(page.locator('[data-probe="check-ats-badge"]')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('skor deterministik: dokumen sama → skor sama', async ({ page }) => {
    const readScore = async (): Promise<string> => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/')
      await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10000 })
      await dismissFirstRun(page)

      const drawer = page.locator('[data-probe="ats-drawer"]')
      await page.locator('[data-probe="check-ats"]').click()
      await expect(drawer).toBeVisible()
      await page.locator('[data-probe="ats-check-now"]').click()
      await expect(drawer.locator('[data-probe="ats-score-value"]')).toBeVisible({ timeout: 10000 })
      const value = await drawer.locator('[data-probe="ats-score-value"]').textContent()
      const band = await drawer.locator('[data-probe="ats-score-band"]').textContent()
      return `${value}|${band}`
    }

    const first = await readScore()
    const second = await readScore()
    expect(second).toBe(first)
  })

  test('toggle stabilo di PDF mengubah berkas unduhan', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10000 })
    await dismissFirstRun(page)

    const drawer = page.locator('[data-probe="ats-drawer"]')
    await page.locator('[data-probe="check-ats"]').click()
    await expect(drawer).toBeVisible()
    await page.locator('[data-probe="ats-check-now"]').click()

    // Tempel deskripsi lowongan supaya ada kata kunci yang bisa distabilo.
    await drawer.locator('button[aria-expanded]').first().click()
    await drawer
      .locator('[data-probe="ats-jd-input"]')
      .fill(
        'Butuh Frontend Engineer dengan React dan TypeScript serta observability wajib. React TypeScript observability React TypeScript observability.',
      )
    await page.waitForTimeout(2500)
    await expect(drawer.locator('[data-probe="ats-keyword-missing"]').first()).toBeVisible()

    const sizeWithMarks = await downloadSize(page, true)
    const sizeWithoutMarks = await downloadSize(page, false)
    expect(sizeWithMarks).toBeGreaterThan(sizeWithoutMarks)
  })

  test('parse tape menyebut baris kontak & heading', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
      timeout: 10000,
    })
    await dismissFirstRun(page)

    const drawer = page.locator('[data-probe="ats-drawer"]')
    await page.locator('[data-probe="check-ats"]').click()
    await expect(drawer).toBeVisible()
    await page.locator('[data-probe="ats-check-now"]').click()

    await drawer.locator('[data-probe="ats-tab-tape"]').click()
    const tape = drawer.locator('[data-probe="ats-tape"]')
    await expect(tape).toBeVisible()
    await expect(tape).toContainText('NAME')
    await expect(tape).toContainText('EMAIL')
    await expect(tape).toContainText('HEADING')
    await expect(tape).toContainText('BULLET')
  })

  test('disclaimer & indikator halaman tampil di keempat breakpoint', async ({ page }) => {
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10000 })
      await dismissFirstRun(page)

      // Di <1024px tombol Periksa ATS ada di menu mobile, bukan di top bar.
      if (width < 1024) await page.getByRole('button', { name: 'Menu' }).click()
      // Tombol di top bar disembunyikan di bawah 1024px, jadi hanya yang terlihat
      // yang diklik (bukan yang masih ada di DOM tapi `display: none`).
      await page
        .locator('[data-probe="check-ats"]:visible, [data-probe="check-ats-mobile"]:visible')
        .first()
        .click()
      const drawer = page.locator('[data-probe="ats-drawer"]')
      await expect(drawer).toBeVisible()
      await expect(drawer.locator('[data-probe="ats-disclaimer"]')).toBeVisible()
      await expect(drawer.locator('[data-probe="ats-check-now"]')).toBeVisible()
    }
  })
})
