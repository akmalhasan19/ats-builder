/**
 * responsive.spec.ts — T9.2 + Gate Fase 9 "checklist viewport"
 *
 * Enam viewport difoto dan diukur: tidak boleh ada scroll horizontal, dan
 * chrome yang dijanjikan §2.4 harus benar-benar muncul di breakpointnya
 * (rail penuh ≥1280, icon rail 1024–1279, dual-tab <1024, sticky bar <768).
 */
import { expect, test, type Page } from '@playwright/test'

type Case = {
  width: number
  height: number
  rail: 'full' | 'icon' | 'hidden'
  tabs: boolean
  sticky: boolean
}

const CASES: Case[] = [
  { width: 360, height: 740, rail: 'hidden', tabs: true, sticky: true },
  { width: 390, height: 844, rail: 'hidden', tabs: true, sticky: true },
  { width: 768, height: 900, rail: 'hidden', tabs: true, sticky: false },
  { width: 1024, height: 900, rail: 'icon', tabs: false, sticky: false },
  { width: 1440, height: 900, rail: 'full', tabs: false, sticky: false },
  { width: 1920, height: 1080, rail: 'full', tabs: false, sticky: false },
]

const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

const prepare = async (page: Page, width: number, height: number): Promise<void> => {
  await page.setViewportSize({ width, height })
  await page.goto('/')
  // #pane-form adalah satu-satunya pane yang pasti terlihat di semua mode
  // (di <1024px pratinjau bersembunyi di tab "Pratinjau").
  await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10_000 })
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 1500 }).catch(() => false)) {
    await page.getByRole('radio', { name: /Nanti saja/ }).click()
    await later.click()
  }
}

test.describe('responsive — 360/390/768/1024/1440/1920', () => {
  for (const item of CASES) {
    test(`${item.width}×${item.height}: tanpa scroll horizontal & chrome sesuai §2.4`, async ({
      page,
    }) => {
      await prepare(page, item.width, item.height)

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)

      const rail = page.locator('aside[aria-label="Bagian"]')
      const tablist = page.getByRole('tablist', { name: 'Mode tampilan' })

      if (item.rail === 'hidden') await expect(rail).toBeHidden()
      else await expect(rail).toBeVisible()

      if (item.rail === 'icon') {
        const box = await rail.boundingBox()
        expect(box?.width).toBeLessThanOrEqual(64)
      }
      if (item.rail === 'full') {
        const box = await rail.boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(200)
      }

      if (item.tabs) await expect(tablist).toBeVisible()
      else await expect(tablist).toBeHidden()

      // Tombol unduh harus terlihat di setiap viewport (P1: satu tugas halaman).
      await expect(page.locator('[data-probe="download-pdf"]:visible').first()).toBeVisible()
      if (item.sticky) {
        await expect(page.getByRole('button', { name: 'Bagian' })).toBeVisible()
      }

      await page.screenshot({ path: `artifacts/fase9/responsive-${item.width}.png` })
    })
  }

  test('360: tab Isi data ↔ Pratinjau berganti pane tanpa reload', async ({ page }) => {
    await prepare(page, 360, 740)
    const tablist = page.getByRole('tablist', { name: 'Mode tampilan' })
    const previewTab = tablist.getByRole('tab', { name: 'Pratinjau' })
    const formTab = tablist.getByRole('tab', { name: 'Isi data' })

    await expect(formTab).toHaveAttribute('aria-selected', 'true')
    await previewTab.click()
    await expect(previewTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('#pane-preview')).toBeVisible()
    await expect(page.locator('#pane-form')).toBeHidden()
    await expect(previewTab).toBeFocused()

    await formTab.click()
    await expect(page.locator('#pane-form')).toBeVisible()

    await page.screenshot({ path: 'artifacts/fase9/responsive-360-preview.png' })
  })

  test('360: sheet "Bagian" membuka daftar bagian dan panah atas/bawah tersedia', async ({
    page,
  }) => {
    await prepare(page, 360, 740)
    await page.getByRole('button', { name: 'Bagian' }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Pindahkan ke atas/ }).first()).toBeVisible()
    await expect(sheet.getByRole('button', { name: /Pindahkan ke bawah/ }).first()).toBeVisible()
    await page.screenshot({ path: 'artifacts/fase9/responsive-360-sections.png' })
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  })

  test('1920: drawer ATS menjadi kolom ke-4 tanpa scrim', async ({ page }) => {
    await prepare(page, 1920, 1080)
    await page.locator('[data-probe="check-ats"]').click()
    const drawer = page.locator('[data-probe="ats-drawer"]')
    await expect(drawer).toBeVisible()

    const box = await drawer.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(380)
    expect(box?.width).toBeLessThanOrEqual(420)
    // Mode dock = elemen <aside>, bukan sheet overlay: tidak boleh ada dialog/scrim.
    await expect(drawer).toHaveJSProperty('tagName', 'ASIDE')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Lembar A4 tetap terlihat utuh di sebelah drawer.
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: 'artifacts/fase9/responsive-1920-drawer.png' })
  })

  test('/templates dan /privacy juga rapi di 360 & 1440', async ({ page }) => {
    for (const route of ['/templates', '/privacy', '/terms']) {
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(route)
        await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
        await page.screenshot({
          path: `artifacts/fase9/responsive-${route.replace(/\W+/g, '') || 'home'}-${width}.png`,
        })
      }
    }
  })
})
