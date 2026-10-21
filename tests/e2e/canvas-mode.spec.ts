import { expect, test, type Page } from '@playwright/test'

/**
 * FASE 12 / C1 — mode pengerjaan lewat menu Tampilan dan undo/redo dokumen.
 * C5.1 — dijalankan di kedua project: desktop memakai popover Tampilan menu,
 * mobile (<1024px) memakai entri yang sama di sheet MobileMenu (D2, §5.3).
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024

/** §5.3 — pemicu menu Tampilan mengikuti panel mode. */
const openTampilan = async (page: Page): Promise<void> => {
  if (isDesktop(page)) {
    await page.locator('[data-probe="tampilan-menu"]').click()
  } else {
    await page.getByRole('button', { name: 'Menu' }).click()
  }
}

const toCanvasMode = async (page: Page): Promise<void> => {
  await openTampilan(page)
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  // Popover/sheet tidak menutupi target kertas — selalu ditutup.
  await page.keyboard.press('Escape')
}

test.describe('menu Tampilan & mode pengerjaan', () => {
  test('mode Langsung di CV terpilih dari menu Tampilan dan bertahan setelah reload', async ({
    page,
  }) => {
    await page.goto('/')
    const shell = page.locator('[data-edit-mode]')
    await expect(shell).toHaveAttribute('data-edit-mode', 'form')

    await toCanvasMode(page)

    await page.reload()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  })

  test('tombol undo/redo membatalkan dan mengulangi edit form', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Lanjut' }).click()

    const name = page.locator('#profile-fullName')
    const initial = await name.inputValue()
    await name.fill('Nama Uji')

    const undo = page.locator('[data-probe="undo"]')
    await expect(undo).toBeEnabled()
    await undo.click()
    await expect(name).toHaveValue(initial)

    const redo = page.locator('[data-probe="redo"]')
    await redo.click()
    await expect(name).toHaveValue('Nama Uji')
  })

  test('shortcut Ctrl+Z di luar field teks membatalkan edit', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Lanjut' }).click()

    const name = page.locator('#profile-fullName')
    const initial = await name.inputValue()
    await name.fill('Ketik Sebentar')
    await name.blur()

    await page.keyboard.press('Control+z')
    await expect(name).toHaveValue(initial)
  })
})
