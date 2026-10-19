/**
 * reorder.spec.ts — T9.2
 *
 * Tiga jalur reorder bagian yang sama harus menghasilkan urutan baru yang sama:
 * mouse (PointerSensor), sentuhan (touch pointer dari CDP), dan keyboard
 * (Space + panah + Space) dengan pengumuman aria-live. Pindah dari
 * `editor-flow.spec.ts` supaya nama berkas sesuai daftar spec T9.2; assertion
 * identik, tidak ada yang dilemahkan.
 */
import { expect, test, type Page } from '@playwright/test'

const readOrder = async (page: Page): Promise<string[]> => {
  const items = page.locator('aside[aria-label="Bagian"] nav > div')
  const count = await items.count()
  const labels: string[] = []
  for (let index = 0; index < count; index += 1) {
    labels.push((await items.nth(index).locator('button').nth(1).innerText()).trim())
  }
  return labels
}

const dragHandleOf = (page: Page, itemIndex: number) =>
  page
    .locator('aside[aria-label="Bagian"] nav > div')
    .nth(itemIndex)
    .getByRole('button', { name: 'Tarik untuk mengubah urutan' })

test.describe('reorder section — mouse, sentuhan, keyboard', () => {
  test('mouse: drag handle memindahkan section ke posisi baru', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const before = await readOrder(page)
    expect(before[0]).toBe('Profil')

    const handle = dragHandleOf(page, 0)
    const handleBox = (await handle.boundingBox())!
    const secondItem = page.locator('aside[aria-label="Bagian"] nav > div').nth(1)
    const secondBox = (await secondItem.boundingBox())!

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    // Geser bertahap supaya PointerSensor (activationConstraint distance 5) aktif.
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, {
      steps: 8,
    })
    await page.mouse.up()

    const after = await readOrder(page)
    expect(after[0]).toBe('Ringkasan')
    expect(after[1]).toBe('Profil')
    await page.screenshot({ path: 'artifacts/fase9/reorder-mouse.png' })
  })

  test('touch: drag handle (pointer touch) memindahkan section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const before = await readOrder(page)
    expect(before[0]).toBe('Profil')

    const handleBox = (await dragHandleOf(page, 0).boundingBox())!
    const secondBox = (await page
      .locator('aside[aria-label="Bagian"] nav > div')
      .nth(1)
      .boundingBox())!

    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2
    const endY = secondBox.y + secondBox.height / 2

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    })
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + ((endY - startY) * step) / 6 }],
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    const after = await readOrder(page)
    expect(after[0]).toBe('Ringkasan')
    expect(after[1]).toBe('Profil')
    await page.screenshot({ path: 'artifacts/fase9/reorder-touch.png' })
  })

  test('keyboard: Space mengangkat, panah memindahkan, Space melepas + pengumuman aria-live', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const before = await readOrder(page)
    expect(before[0]).toBe('Profil')

    // fokus ke drag handle section pertama lalu operasikan keyboard sensor dnd-kit
    await dragHandleOf(page, 0).focus()
    await page.keyboard.press('Space')
    await expect(page.locator('[data-probe="drag-overlay"]')).toBeVisible()
    // Sensor keyboard dnd-kit butuh satu frame untuk menyusun ulang rect item
    // sebelum panah pertama diproses; tanpa jeda ini ArrowDown tertelan.
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('Space')

    await expect
      .poll(async () => (await readOrder(page)).slice(0, 2), { timeout: 5000 })
      .toEqual(['Ringkasan', 'Profil'])

    // aria-live mengumumkan urutan baru (T3.2)
    await expect(page.locator('div.sr-only[role="status"]')).toContainText(
      /pindah ke posisi 2 dari/,
    )
    await page.screenshot({ path: 'artifacts/fase9/reorder-keyboard.png' })
  })

  test('urutan dokumen ikut berubah: heading di lembar A4 menukar posisi', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    // Header nama tidak punya heading bagian, jadi daftar h2 di lembar = urutan
    // bagian setelah Profil. Memindahkan rail[1] ke rail[2] harus menukar
    // heading[0] dan heading[1] di dokumen — bukan hanya di rail.
    const headings = async (): Promise<string[]> => {
      const texts = await page
        .locator('#pane-preview [data-probe="preview-block"] h2')
        .allInnerTexts()
      return texts.map((value) => value.replace(/\s+/g, ' ').trim())
    }

    const before = await headings()
    expect(before.length).toBeGreaterThanOrEqual(3)
    expect(before[0]).toBe('RINGKASAN')
    expect(before[1]).toBe('PENGALAMAN')

    await dragHandleOf(page, 1).focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('Space')

    const expected = [before[1], before[0], ...before.slice(2)]
    await expect.poll(async () => headings(), { timeout: 5000 }).toEqual(expected)
    await page.screenshot({ path: 'artifacts/fase9/reorder-preview.png' })
  })
})
