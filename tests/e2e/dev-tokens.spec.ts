import { expect, test } from '@playwright/test'

const COLOR_TOKEN_COUNT = 19
const FONT_FACE_COUNT = 9

const CHROME_TYPE_TOKENS = [
  'text-brand',
  'text-eyebrow',
  'text-panel-title',
  'text-label',
  'text-input',
  'text-body',
  'text-button-primary',
  'text-data',
  'text-tape',
]
const HOME_TYPE_TOKENS = ['display-xl', 'display-md', 'body-lg']

const VIEWPORTS = [
  { label: '360', width: 360, height: 740 },
  { label: '768', width: 768, height: 900 },
  { label: '1024', width: 1024, height: 900 },
  { label: '1440', width: 1440, height: 1000 },
]

test('seluruh token warna §2.2 tampil di /dev/tokens', async ({ page }) => {
  await page.goto('/dev/tokens')
  const swatches = page.locator('[data-probe="swatch"]')
  await expect(swatches).toHaveCount(COLOR_TOKEN_COUNT)
  await expect(page.getByText('--color-cyanotype', { exact: true })).toBeVisible()
  await expect(page.getByText('--color-highlighter', { exact: true })).toBeVisible()
  // nilai hex dibaca dari CSS yang aktif, bukan ditulis ulang di komponen
  for (let i = 0; i < COLOR_TOKEN_COUNT; i += 1) {
    await expect(swatches.nth(i).locator('[data-probe="swatch-value"]')).not.toBeEmpty()
  }
})

const CATALOG_SECTIONS = [
  'panel-header',
  'buttons',
  'icon-buttons',
  'fields',
  'toggles',
  'chips',
  'empty-state',
  'dialog',
  'sheet',
  'popover',
  'tooltip',
  'tabs',
  'accordion',
  'scroll',
  'toast',
]

test('katalog primitif T2.1 lengkap di /dev/tokens', async ({ page }) => {
  await page.goto('/dev/tokens')
  for (const section of CATALOG_SECTIONS) {
    await expect(page.locator(`[data-catalog="${section}"]`)).toBeVisible()
  }
  await expect(page.locator('[data-catalog="buttons"] button')).toHaveCount(13)
  await expect(page.getByRole('button', { name: 'Buka dialog' })).toBeVisible()

  // State hover nyata, bukan hanya kelas di markup (§5.2).
  const primary = page.locator('[data-catalog="buttons"] button').first()
  await primary.hover()
  await expect(primary).toHaveCSS('background-color', 'rgb(18, 121, 163)')

  // Tooltip harus memakai surface mesin dengan teks terang (§5.11).
  await page.getByRole('button', { name: 'Arahkan kursor ke sini' }).hover()
  const tooltip = page.locator('[data-slot="tooltip-content"]')
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toHaveCSS('color', 'rgb(232, 237, 244)')
  await expect(tooltip).toHaveCSS('background-color', 'rgb(16, 22, 31)')
})

test('seluruh skala tipe §2.3 tampil beserta metrik terukurnya', async ({ page }) => {
  await page.goto('/dev/tokens')
  for (const utility of [...CHROME_TYPE_TOKENS, ...HOME_TYPE_TOKENS]) {
    await expect(page.locator(`[data-type-token="${utility}"]`)).toBeVisible()
  }
  await expect(page.locator('[data-type-token="text-brand"]')).toHaveCSS(
    'text-transform',
    'uppercase',
  )
  await expect(page.locator('[data-type-token="text-eyebrow"]')).toHaveCSS(
    'font-family',
    /IBM Plex Mono/,
  )
  await expect(page.locator('[data-type-token="display-xl"]')).toHaveCSS('font-family', /Archivo/)
})

test('sembilan @font-face layar self-host terdaftar', async ({ page }) => {
  await page.goto('/dev/tokens')
  await expect(page.locator('[data-probe="swatch"]')).toHaveCount(COLOR_TOKEN_COUNT)
  await expect(page.locator('[data-probe="font-face"][data-declared="true"]')).toHaveCount(
    FONT_FACE_COUNT,
  )
})

test('navigasi keyboard penuh tanpa mouse', async ({ page }) => {
  await page.goto('/dev/tokens')
  await expect(page.locator('[data-probe="swatch"]')).toHaveCount(COLOR_TOKEN_COUNT)

  await page.keyboard.press('Tab')
  await expect(page.locator('a[href="#dev-main"]')).toBeFocused()

  const visited = new Set<string>()
  let reachedInput = false
  for (let i = 0; i < 45 && !reachedInput; i += 1) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return { tag: '', id: '' }
      return { tag: el.tagName, id: el instanceof HTMLElement ? el.id : '' }
    })
    visited.add(focused.tag)
    reachedInput = focused.id === 'tokens-input-default'
  }

  expect(visited.has('BUTTON'), 'Tab harus menjangkau tombol').toBe(true)
  expect(reachedInput, 'Tab harus menjangkau input').toBe(true)

  // §5.4 — fokus input memakai ring/border cyanotype, terlihat tanpa mouse
  await expect(page.locator('#tokens-input-default')).toHaveCSS('border-color', /15, 90, 120/)
})

test('screenshot /dev/tokens pada 4 breakpoint tanpa horizontal scroll', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/dev/tokens')
    await expect(page.locator('[data-probe="swatch"]')).toHaveCount(COLOR_TOKEN_COUNT)
    await page.screenshot({ path: `artifacts/dev-tokens-${viewport.label}.png`, fullPage: true })

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(
      geometry.scrollWidth,
      `horizontal scroll muncul di lebar ${viewport.width}`,
    ).toBeLessThanOrEqual(geometry.clientWidth + 1)
  }
})
