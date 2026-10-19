import { expect, test } from '@playwright/test'

test('homepage Fase 8: workspace hidup + 4 section + footer legal', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()

  await expect(
    page.getByRole('heading', { name: 'Lima template, satu aturan: satu kolom.' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tulis CV yang terbaca mesin.' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Dari kosong sampai PDF dalam tiga langkah.' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Yang sering ditanyakan.' })).toBeVisible()

  const h1Count = await page.locator('h1').count()
  expect(h1Count).toBe(1)
})

test('galeri homepage: klik kartu = set template + toast', async ({ page }) => {
  await page.goto('/')

  const card = page.getByRole('button', { name: /Pakai template ini: Ledger \(GALERI TEMPLATE\)/ })
  await card.scrollIntoViewIfNeeded()
  await expect(card).toBeVisible()
  await card.click()

  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Ledger' })).toBeVisible()
})

test('anchor ChevronDown + footer mencapai tiap section', async ({ page }) => {
  await page.goto('/')

  const chevron = page.getByRole('link', { name: 'Template', exact: true }).first()
  await expect(chevron).toBeVisible()
  await chevron.click()
  await expect(
    page.getByRole('heading', { name: 'Lima template, satu aturan: satu kolom.' }),
  ).toBeInViewport()

  for (const [link, heading] of [
    ['Panduan ATS', 'Tulis CV yang terbaca mesin.'],
    ['Cara pakai', 'Dari kosong sampai PDF dalam tiga langkah.'],
    ['FAQ', 'Yang sering ditanyakan.'],
  ] as const) {
    await page
      .getByRole('navigation', { name: 'Sumber daya' })
      .getByRole('link', { name: link, exact: true })
      .click()
    await expect(page.getByRole('heading', { name: heading })).toBeInViewport()
  }
})

test('rute legal nyata: /privacy dan /terms bukan placeholder', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Kebijakan Privasi', level: 1 })).toBeVisible()
  await expect(page.getByText('IndexedDB')).toBeVisible()

  await page.goto('/terms')
  await expect(page.getByRole('heading', { name: 'Ketentuan Penggunaan', level: 1 })).toBeVisible()
  await expect(page.getByText('tidak ada jaminan lolos')).toBeVisible()
})

test('footer membawa pernyataan privasi satu baris (§5.8)', async ({ page }) => {
  await page.goto('/')
  const footer = page.getByRole('contentinfo')
  // Section 2–6 = chunk lazy; tunggu footer-nya sendiri supaya tidak balapan.
  await expect(footer).toBeVisible()
  await expect(footer.getByText(/Semua data CV diproses di browser kamu/)).toBeVisible()
  const navs = await footer.getByRole('navigation').count()
  expect(navs).toBe(4)
})

test('JSON-LD SoftwareApplication + FAQPage ada di head', async ({ page }) => {
  await page.goto('/')
  // FAQPage dirender oleh chunk lazy HomeSections — tunggu footer terpasang.
  await expect(page.getByRole('contentinfo')).toBeVisible()

  const payloads = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(payloads.some((raw) => raw.includes('"SoftwareApplication"'))).toBe(true)
  const faq = payloads.find((raw) => raw.includes('"FAQPage"'))
  expect(faq).toBeTruthy()
  const parsed = JSON.parse(faq as string)
  expect(parsed.mainEntity).toHaveLength(8)
})
