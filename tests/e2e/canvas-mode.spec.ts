import { expect, test } from '@playwright/test'

/**
 * FASE 12 / C1 — mode pengerjaan lewat menu Tampilan dan undo/redo dokumen.
 * Desktop saja: kanvas mobile milik C5.
 */

test.describe('menu Tampilan & mode pengerjaan', () => {
  test('mode Langsung di CV terpilih dari menu Tampilan dan bertahan setelah reload', async ({
    page,
  }) => {
    await page.goto('/')
    const shell = page.locator('[data-edit-mode]')
    await expect(shell).toHaveAttribute('data-edit-mode', 'form')

    await page.locator('[data-probe="tampilan-menu"]').click()
    await page.locator('[data-probe="edit-mode-canvas"]').click()
    await expect(shell).toHaveAttribute('data-edit-mode', 'canvas')

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
