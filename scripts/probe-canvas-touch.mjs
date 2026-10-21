/* Probe sementara C5.1 — ukur geometri target sentuh kanvas di Pixel 7.
 * Bukan bukti gate; alat diagnosis: padding/kalkula rect terhadap zoom.
 * PAKAI: jalankan `pnpm dev --port 5173` di terminal lain, lalu
 *   node scripts/probe-canvas-touch.mjs
 */
import { chromium, devices } from '@playwright/test'

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['Pixel 7'] })
const page = await context.newPage()
await page.setViewportSize({ width: 412, height: 915 })
await page.goto('http://localhost:5173/')
await page.getByRole('button', { name: 'Lanjut' }).waitFor({ timeout: 10_000 })
await page.getByRole('button', { name: 'Lanjut' }).click()
await page.getByRole('tab', { name: /Pratinjau/ }).click()
await page
  .locator('#pane-preview [data-probe="page-sheet"]')
  .first()
  .waitFor({ state: 'visible', timeout: 10_000 })

// Masuk mode kanvas via sheet MobileMenu.
await page.getByRole('button', { name: 'Menu' }).click()
await page.locator('[data-probe="edit-mode-canvas"]').click()
await page.keyboard.press('Escape')

const info = await page.evaluate(() => {
  const paper = document.querySelector('[data-probe="preview-content"]')
  const zoomEl = document.querySelector('[data-probe="zoom-value"]')
  const zoomText = zoomEl ? zoomEl.textContent : null
  const paperStyle = paper ? getComputedStyle(paper).transform : null
  const fields = [...document.querySelectorAll('#pane-preview [data-canvas-field]')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .slice(0, 8)
    .map((el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return {
        field: el.getAttribute('data-field'),
        rectH: Math.round(rect.height * 100) / 100,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        lineHeight: style.lineHeight,
        fontSize: style.fontSize,
        inlinePeerH: Math.round(el.parentElement.getBoundingClientRect().height * 100) / 100,
      }
    })
  const ghosts = [...document.querySelectorAll('#pane-preview [data-canvas-ghost]')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => {
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      return { minH: style.minHeight, rectH: Math.round(rect.height * 100) / 100 }
    })
  return { zoomText, paperStyle, fields, ghosts, panelMode: document.querySelector('[data-panel-mode]')?.getAttribute('data-panel-mode') }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
