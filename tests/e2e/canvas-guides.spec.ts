/**
 * canvas-guides.spec.ts — FASE 12 / C2
 *
 * Guide placeholder di atas kertas (D5): di mode kanvas, field kosong
 * menampilkan teks pemandu yang mengikuti layout template aktif. Spec ini
 * membuktikan guide muncul pada kelima template, tidak muncul di mode form,
 * dan tidak merusak aksesibilitas (axe).
 *
 * C5.1 — dijalankan di kedua project: desktop kanvas popover Tampilan menu,
 * mobile (<1024px) mode kertas dibuka lewat tab Pratinjau + sheet MobileMenu.
 */
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const TEMPLATES = ['Classic ATS', 'Ledger', 'Executive', 'Minimal', 'Technician'] as const

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024

const sheet = (page: Page) => page.locator('#pane-preview [data-probe="page-sheet"]').first()
const canvasFields = (page: Page) => page.locator('#pane-preview [data-canvas-field]')
const guideFields = (page: Page) => page.locator('#pane-preview [data-canvas-guide="true"]')

/** Mulai dari dokumen kosong supaya kerangka guide terlihat utuh. */
const startEmptyDoc = async (page: Page): Promise<void> => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    await page.getByRole('radio', { name: /Mulai dari kosong/ }).click()
    await later.click()
    await expect(later).toBeHidden({ timeout: 5000 })
  }
}

const toCanvasMode = async (page: Page): Promise<void> => {
  if (isDesktop(page)) {
    await page.locator('[data-probe="tampilan-menu"]').click()
  } else {
    await page.getByRole('button', { name: 'Menu' }).click()
  }
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  // Popover/sheet menutupi target di kertas — tutup supaya interaksi kanvas
  // berikutnya tidak tertahan overlay (desktop: popover Tampilan; mobile:
  // sheet MobileMenu, lalu pindah ke tab Pratinjau tempat kertas hidup).
  // FASE 13 (D1, §4) — di mode kanvas kertas langsung jadi satu pane: tab bar
  // mobile tidak dirender lagi, jadi tidak ada tab Pratinjau untuk diklik.
  await page.keyboard.press('Escape')
}

const applyTemplate = async (page: Page, name: string): Promise<void> => {
  if (isDesktop(page)) {
    await page.locator('[data-probe="template-trigger"]').click()
    const option = page
      .locator('[data-radix-popper-content-wrapper] button')
      .filter({ hasText: name })
      .first()
    await expect(option).toBeVisible()
    await option.click()
    await expect(page.locator('[data-probe="template-trigger"]')).toContainText(name)
    return
  }
  // Mobile: pilihan template hidup di sheet MobileMenu (D2).
  await page.getByRole('button', { name: 'Menu' }).click()
  const sheetBody = page.locator('[data-slot="sheet-content"]')
  const option = page.getByRole('button', { name }).filter({ hasText: name }).first()
  await expect(option).toBeVisible()
  await option.click()
  // C5.6 — klik opsi memicu render ulang pratinjau, sehingga fokus bisa
  // berpindah dan Escape tidak selalu sampai ke handler dialog. Tutup lewat
  // tombol Tutup (deterministik) lalu pastikan sheet benar-benar hilang.
  await sheetBody.getByRole('button', { name: 'Tutup' }).click()
  await expect(sheetBody).toBeHidden()
}

const axeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? 'unknown'))
}

/** Viewport desktop eksplisit di project desktop; project mobile memakai Pixel 7. */
const openWorkspace = async (page: Page): Promise<void> => {
  if (isDesktop(page)) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
}

test.describe('guide placeholder di atas kertas (C2)', () => {
  test('dokumen kosong di mode kanvas menampilkan kerangka guide lengkap', async ({ page }) => {
    await openWorkspace(page)
    await startEmptyDoc(page)
    await toCanvasMode(page)

    await expect(guideFields(page).first()).toBeVisible()
    const text = (await sheet(page).innerText()).replace(/\s+/g, ' ')
    for (const guide of [
      'Nama lengkap',
      'Role yang kamu lamar',
      'Email',
      'Nomor telepon',
      'Lokasi',
      'Ringkasan profesional',
      'Peran',
      'Perusahaan',
      'Satu bullet: aksi + dampak',
    ]) {
      expect(text, `guide "${guide}" harus muncul di kerangka`).toContain(guide)
    }

    // Setiap segmen adalah target klik dengan nama field yang jelas (D11).
    const name = page.locator('#pane-preview [data-field="profile.fullName"]')
    await expect(name).toHaveAttribute('aria-label', 'Isi nama lengkap: Nama lengkap')
    await expect(name).toHaveAttribute('data-canvas-guide', 'true')
  })

  test('guide mengikuti layout template: gaya nama berubah antar template', async ({ page }) => {
    await openWorkspace(page)
    await startEmptyDoc(page)
    await toCanvasMode(page)

    const nameGuide = page.locator('#pane-preview [data-field="profile.fullName"]')
    const fonts: string[] = []
    for (const template of TEMPLATES) {
      await applyTemplate(page, template)
      await expect(sheet(page)).toContainText('Nama lengkap')
      await expect(nameGuide).toBeVisible()
      fonts.push(await nameGuide.evaluate((el) => getComputedStyle(el).fontFamily))
    }
    // Family berbeda → guide benar-benar mengikuti spec template, bukan gaya
    // global yang sama untuk semua template.
    expect(new Set(fonts).size).toBeGreaterThan(1)
  })

  test('mode form: nol guide di kertas dan thumbnail', async ({ page }) => {
    await openWorkspace(page)
    await startEmptyDoc(page)
    if (!isDesktop(page)) await page.getByRole('tab', { name: /Pratinjau/ }).click()

    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'form')
    await expect(canvasFields(page)).toHaveCount(0)
    expect(await sheet(page).innerText()).not.toContain('Nama lengkap')

    // Thumbnail template juga selalu memakai jalur form (D4).
    if (isDesktop(page)) {
      await page.locator('[data-probe="template-trigger"]').click()
    } else {
      // Mobile: popover thumbnail tidak ada; template diganti dari sheet menu.
      await page.getByRole('button', { name: 'Menu' }).click()
      await page.getByRole('button', { name: 'Ledger' }).click()
      await page.keyboard.press('Escape')
    }
    await expect(page.locator('[data-probe="page-sheet"]').first()).toBeVisible()
    await expect(page.locator('[data-canvas-field]')).toHaveCount(0)
  })

  test('axe: 0 violation serius di mode kanvas', async ({ page }) => {
    await openWorkspace(page)
    await startEmptyDoc(page)
    await toCanvasMode(page)
    await expect(guideFields(page).first()).toBeVisible()

    // Beri waktu reflow konsolidasi antre re-render sebelum pengukuran axe.
    await page.waitForTimeout(400)

    const violations = await axeViolations(page)
    expect(violations.map((v) => `${v.impact}/${v.id}`)).toEqual([])
  })
})
