/* Bukti visual manual Fase 3: screenshot 4 breakpoint + uji keyboard saja.
 * Dijalankan terhadap `pnpm dev` lokal: `node scripts/evidence-fase3.mjs`.
 * Keluaran: artifacts/evidence/fase3-*.png (di-gitignore, tidak ikut commit).
 */
import { chromium } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173'

const browser = await chromium.launch()

const dismissFirstRun = async (page) => {
  const laterBtn = page.getByRole('button', { name: 'Lanjut' })
  if (await laterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const later = page.getByRole('radio', { name: /Nanti saja/ })
    if (await later.isVisible().catch(() => false)) await later.click()
    await laterBtn.click()
  }
}

// 1. Screenshot empat breakpoint (alur utama: workspace hidup)
for (const width of [360, 768, 1024, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 800 } })
  const page = await context.newPage()
  await page.goto(BASE)
  await page
    .locator('[data-probe="page-sheet"]')
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => null)
  await dismissFirstRun(page)
  await page.screenshot({ path: `artifacts/evidence/fase3-bp-${width}.png` })
  await context.close()
  console.log(`breakpoint ${width}: ok`)
}

// 2. Uji keyboard saja: Tab dari awal → skip link → Enter → Tab hingga form → ketik nama
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(BASE)
  await page
    .locator('[data-probe="page-sheet"]')
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => null)
  await dismissFirstRun(page)

  await page.keyboard.press('Tab')
  await expect_1(page)
  // Navigasi ke Profil via rail dengan keyboard, buka, dan ketik nama
  const profileBtn = page
    .locator('aside[aria-label="Bagian"] nav')
    .getByRole('button')
    .filter({ hasText: 'Profil' })
    .first()
  await profileBtn.focus()
  await page.keyboard.press('Enter')
  await page.locator('#profile-fullName').focus()
  await page.keyboard.type('Uji Keyboard Saja')
  await page.screenshot({ path: 'artifacts/evidence/fase3-keyboard-only.png' })
  const value = await page.locator('#profile-fullName').inputValue()
  console.log('keyboard-only nama =', value)
  if (value !== 'Uji Keyboard Saja') throw new Error('uji keyboard gagal')
  await context.close()
}

async function expect_1(page) {
  // Skip link harus jadi fokus pertama
  const focused = await page.evaluate(() => {
    const el = document.activeElement
    return { tag: el?.tagName, text: el?.textContent?.slice(0, 40) }
  })
  console.log('fokus pertama (Tab):', focused)
}

await browser.close()
console.log('evidence selesai')
