import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-a11y.spec.ts — FASE 12 / C5.4 (D11, P8)
 *
 * Aksesibilitas kanvas adalah floor, bukan tambahan:
 *  - navigasi keyboard penuh tanpa mouse: Tab masuk ke segmen pertama, Enter
 *    membuka editor, Enter commit, fokus kembali ke pemicu, Tab lanjut ke
 *    segmen berikutnya, Ctrl+Z membatalkan satu commit;
 *  - live region mengumumkan pergantian mode pengerjaan;
 *  - prefers-reduced-motion mematikan motion affordance kanvas;
 *  - axe 0 violation critical/serious di mode kanvas (mode form diaudit
 *    `a11y.spec.ts`).
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024

const segments = (page: Page) => page.locator('#pane-preview [data-canvas-field]')
const editor = (page: Page) => page.locator('#pane-preview .canvas-editor')

const startApp = async (page: Page): Promise<void> => {
  if (isDesktop(page)) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', { name: /Nanti saja/ })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
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
  await page.keyboard.press('Escape')
  if (!isDesktop(page)) await page.getByRole('tab', { name: /Pratinjau/ }).click()
}

test.describe('aksesibilitas kanvas (C5.4)', () => {
  test('keyboard penuh: Tab → Enter → ketik → Enter → Tab → Ctrl+Z', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Titik masuk keyboard: kontrol terakhir toolbar pratinjau, lalu Tab masuk
    // ke segmen pertama kertas (urutan Tab = urutan baca dokumen).
    await page.locator('[data-probe="tampilan-menu"]').focus()
    await page.keyboard.press('Tab')
    const first = segments(page).first()
    await expect(first).toBeFocused()
    const firstField = await first.getAttribute('data-field')
    expect(firstField).toBe('profile.fullName')

    await page.keyboard.press('Enter')
    const control = editor(page)
    await expect(control).toBeFocused()

    // Ketik menggantikan teks terpilih (auto select saat sesi dibuka).
    await control.pressSequentially('Nama Keyboard')
    await control.press('Enter')
    await expect(segments(page).filter({ hasText: 'Nama Keyboard' })).toHaveCount(1)
    // D11 — fokus kembali ke tombol pemicu, bukan hilang ke body.
    await expect(first).toBeFocused()

    // Tab lanjut ke segmen berikutnya (bukan keluar dari kertas).
    await page.keyboard.press('Tab')
    const nextField = await page.evaluate(() => document.activeElement?.getAttribute('data-field'))
    expect(nextField).not.toBe(firstField)
    expect(nextField).toBeTruthy()

    // Ctrl+Z membatalkan satu commit kanvas (D9).
    await page.keyboard.press('Control+z')
    await expect(segments(page).filter({ hasText: 'Nama Keyboard' })).toHaveCount(0)
    await expect(first).toHaveText('Alex Morgan')
  })

  test('live region mengumumkan pergantian mode pengerjaan', async ({ page }) => {
    await startApp(page)

    const live = page.locator('[data-probe="edit-mode-announce"]')
    await expect(live).toHaveAttribute('aria-live', 'polite')
    await expect(live).toHaveText('Mode pengerjaan: Form terpandu.')

    await toCanvasMode(page)
    await expect(live).toHaveText('Mode pengerjaan: Langsung di CV.')

    // Kembali ke form juga diumumkan.
    await page.locator('[data-probe="tampilan-menu"]').click()
    await page.locator('[data-probe="edit-mode-form"]').click()
    await page.keyboard.press('Escape')
    await expect(live).toHaveText('Mode pengerjaan: Form terpandu.')
  })

  test('prefers-reduced-motion: motion affordance kanvas berdurasi ~0', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startApp(page)
    await toCanvasMode(page)

    const durations = await page.evaluate(() => {
      const nodes = [
        document.querySelector('#pane-preview [data-canvas-field]'),
        document.querySelector('#pane-preview [data-canvas-ghost]'),
        document.querySelector('#pane-preview [data-probe="page-sheet"]'),
      ]
      return nodes.map((node) => {
        if (!(node instanceof HTMLElement)) return 'missing'
        const style = getComputedStyle(node)
        return `${style.animationDuration}/${style.transitionDuration}`
      })
    })
    for (const value of durations) {
      if (value === 'missing') continue
      const numbers = value
        .split('/')
        .flatMap((part) => part.split(',').map((raw) => parseFloat(raw)))
        .filter((n) => Number.isFinite(n))
      expect(Math.max(...numbers), value).toBeLessThan(0.01)
    }
  })

  test('axe: 0 violation serius di mode kanvas (guide + ghost row)', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    await expect(segments(page).first()).toBeVisible()
    await page.waitForTimeout(400)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact ?? 'unknown'),
    )
    expect(violations.map((v) => `${v.impact}/${v.id}`)).toEqual([])
  })
})
