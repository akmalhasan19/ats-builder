import { expect, test, type Page } from '@playwright/test'

/** SPEC DEBUG SEMENTARA — dihapus setelah akar masalah ketemu. */

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

const scrollLeftOf = (page: Page) =>
  page.evaluate(
    () => document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')?.scrollLeft ?? -1,
  )

test('debug: scrollLeft samples sekitar gulir manual', async ({ page }) => {
  const logs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (text.includes('[follow]')) logs.push(text)
  })
  await startApp(page)
  await toCanvasMode(page)

  await page.locator('#pane-preview [data-field="profile.fullName"]').click()
  const editor = page.locator('#pane-preview .canvas-editor')
  await expect(editor).toBeVisible()
  await page.waitForTimeout(300)

  await editor.pressSequentially('f'.repeat(30))
  await page.waitForTimeout(700)
  const peak = await scrollLeftOf(page)
  console.log('PEAK', peak)

  // Instrumentasi: rekam event scroll/selectionchange/input di sekitar
  // gulir manual — siapa yang memicu kamera bergerak lagi.
  await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
    const dbg: unknown[] = []
    ;(window as unknown as { __dbg: unknown[] }).__dbg = dbg
    const mark = (kind: string) =>
      dbg.push({
        kind,
        t: Math.round(performance.now()),
        sl: scroller?.scrollLeft ?? -1,
        active: document.activeElement?.tagName ?? '',
      })
    scroller?.addEventListener('scroll', () => mark('scroll'), { passive: true })
    document.addEventListener('selectionchange', () => mark('selectionchange'))
    document.addEventListener('input', (e) => mark(`input:${(e.target as HTMLElement).tagName}`), {
      capture: true,
    })
  })

  const immediate = await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
    if (!scroller) return -1
    scroller.scrollLeft -= 30
    return scroller.scrollLeft
  })
  console.log('IMMEDIATE', immediate)

  const after: number[] = []
  for (let i = 0; i < 10; i += 1) {
    after.push(await scrollLeftOf(page))
    await page.waitForTimeout(50)
  }
  console.log('AFTER', after.join(','))

  const events = await page.evaluate(() => (window as unknown as { __dbg: unknown[] }).__dbg)
  console.log('EVENTS', JSON.stringify(events))
  console.log('FOLLOW-LOGS', JSON.stringify(logs))

  const maxScroll = await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
    return scroller ? { sw: scroller.scrollWidth, cw: scroller.clientWidth } : null
  })
  console.log('GEOM', JSON.stringify(maxScroll))
  expect(true).toBe(true)
})
