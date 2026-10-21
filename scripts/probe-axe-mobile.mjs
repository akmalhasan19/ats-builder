/* Probe sementara C5.1 — dump pelanggaran axe di Pixel 7 saat editor kanvas terbuka.
 * PAKAI: dev server 5173 lalu `node scripts/probe-axe-mobile.mjs`
 */
import { AxeBuilder } from '@axe-core/playwright'
import { chromium, devices } from '@playwright/test'

const browser = await chromium.launch()
const context = await browser.newContext({ ...devices['Pixel 7'] })
const page = await context.newPage()
await page.goto('http://localhost:5173/')
await page.getByRole('button', { name: 'Lanjut' }).waitFor({ timeout: 10_000 })
await page.getByRole('button', { name: 'Lanjut' }).click()
await page.getByRole('tab', { name: /Pratinjau/ }).click()
await page
  .locator('#pane-preview [data-probe="page-sheet"]')
  .first()
  .waitFor({ state: 'visible', timeout: 10_000 })
await page.getByRole('button', { name: 'Menu' }).click()
await page.locator('[data-probe="edit-mode-canvas"]').click()
await page.keyboard.press('Escape')
await page.locator('#pane-preview [data-field="profile.fullName"]').click()
await page.locator('#pane-preview .canvas-editor').waitFor({ state: 'visible', timeout: 8_000 })

const loops = Number(process.env.LOOPS ?? 3)
for (let i = 0; i < loops; i += 1) {
  // tanpa jeda pada iterasi 1 (replikasi kondisi e2e), iterasi berikutnya beri jeda
  if (i > 0) await page.waitForTimeout(1200)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  )
  console.log(`run ${i + 1}: violations=${results.violations.length} serious=${serious.length}`)
  for (const violation of serious) {
    console.log(`  [${violation.impact}] ${violation.id}`)
    for (const node of violation.nodes.slice(0, 6)) {
      console.log('    target:', node.target.join(' > '))
      console.log('    html:', node.html.slice(0, 200))
    }
  }
}
await browser.close()
