import { expect, test, type Page } from '@playwright/test'

const VIEWPORTS = [
  { label: '360', width: 360, height: 740, mode: 'tabs' },
  { label: '768', width: 768, height: 900, mode: 'tabs' },
  { label: '1024', width: 1024, height: 900, mode: 'icon-rail' },
  { label: '1440', width: 1440, height: 1000, mode: '3col' },
  { label: '1920', width: 1920, height: 1080, mode: '3col' },
] as const

const ROUTES = [
  { path: '/templates', heading: 'Lima template, satu aturan: satu kolom.' },
  { path: '/dashboard', heading: 'Dashboard CV' },
  { path: '/login', heading: 'Masuk' },
  { path: '/auth/callback', heading: 'Menyelesaikan proses masuk' },
  { path: '/privacy', heading: 'Kebijakan privasi' },
  { path: '/terms', heading: 'Ketentuan penggunaan' },
  { path: '/cover-letter', heading: 'Surat lamaran' },
  { path: '/r/contoh-id', heading: null },
]

async function horizontalOverflow(
  page: Page,
): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
}

async function collectCls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
            if (!shift.hadRecentInput) total += shift.value ?? 0
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })
        setTimeout(() => {
          observer.disconnect()
          resolve(total)
        }, 600)
      }),
  )
}

test('workspace langsung hidup: brand, judul, status, rail, dan lembar A4', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await page.goto('/')

  await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Bagian' })).toBeVisible()
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
  await expect(page.getByRole('status', { name: 'Status penyimpanan' })).toContainText(
    'Disimpan di perangkat',
  )
  await expect(page.getByRole('button', { name: /Ubah judul CV/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('resize 360 → 1920 tanpa layout rusak dan tanpa scroll horizontal', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')

    await expect(page.locator('[data-panel-mode]')).toHaveAttribute(
      'data-panel-mode',
      viewport.mode,
    )
    const paper = page.locator('#pane-preview [data-probe="page-sheet"]').first()
    if (viewport.width >= 1024) {
      await expect(paper).toBeVisible()
    } else {
      // Di bawah 1024 hanya satu pane yang tampil; tab Pratinjau diuji terpisah.
      await expect(paper).toBeHidden()
      await expect(page.locator('#pane-form')).toBeVisible()
    }

    const geometry = await horizontalOverflow(page)
    expect(
      geometry.scrollWidth,
      `horizontal scroll di lebar ${viewport.width}`,
    ).toBeLessThanOrEqual(geometry.clientWidth + 1)

    const rail = page.locator('aside[aria-label="Bagian"]')
    if (viewport.width >= 1024) {
      await expect(rail).toBeVisible()
    } else {
      await expect(rail).toBeHidden()
    }

    const tabBar = page.getByRole('tablist', { name: 'Mode tampilan' })
    if (viewport.width < 1024) {
      await expect(tabBar).toBeVisible()
    } else {
      await expect(tabBar).toBeHidden()
    }

    const sticky = page.getByRole('button', { name: 'Bagian', exact: true })
    if (viewport.width < 768) {
      await expect(sticky).toBeVisible()
    } else {
      await expect(sticky).toBeHidden()
    }

    await page.screenshot({
      path: `artifacts/shell-${viewport.label}.png`,
      fullPage: false,
    })
  }
})

test('tab mobile menukar isi data dan pratinjau tanpa scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await page.goto('/')

  await expect(page.locator('#pane-form')).toBeVisible()
  await page.getByRole('tab', { name: 'Pratinjau' }).click()

  await expect(page.locator('#pane-preview')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Pratinjau' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  const geometry = await horizontalOverflow(page)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
  await page.screenshot({ path: 'artifacts/shell-360-preview.png' })

  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('heading', { name: 'Dokumen' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ledger' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Dokumen' })).toBeHidden()
})

test('keyboard saja: skip link, ubah judul, lalu ganti template', async ({ page }) => {
  await page.goto('/')

  // Hardening T9.2 — mulai perjalanan keyboard dari titik yang pasti. Tanpa
  // reset, Tab pertama sesekali mendarat di luar dokumen di mesin berisi beban
  // (suite paralel penuh), sehingga test ini pernah flake di Fase 8.
  await page.locator('body').focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('a[href="#workspace-main"]')).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /kembali ke editor/ })).toBeFocused()

  await page.keyboard.press('Tab')
  const titleButton = page.getByRole('button', { name: /Ubah judul CV/ })
  await expect(titleButton).toBeFocused()

  await page.keyboard.press('Enter')
  await page.keyboard.type('CV Keyboard')
  await page.keyboard.press('Enter')

  await expect(titleButton).toContainText('CV Keyboard')
  await expect(page.getByRole('status', { name: 'Status penyimpanan' })).toContainText(
    'Disimpan di perangkat',
  )

  const trigger = page.locator('[data-probe="template-trigger"]')
  await expect(trigger).toContainText('Classic ATS')
  await trigger.focus()
  await page.keyboard.press('Enter')

  const ledger = page
    .locator('[data-radix-popper-content-wrapper] button', { hasText: 'Ledger' })
    .first()
  await expect(ledger).toBeVisible()
  await ledger.focus()
  await page.keyboard.press('Enter')

  await expect(trigger).toContainText('Ledger')

  let reachedRail = false
  for (let i = 0; i < 60 && !reachedRail; i += 1) {
    await page.keyboard.press('Tab')
    reachedRail = await page.evaluate(() => {
      const active = document.activeElement
      return (
        active instanceof HTMLElement &&
        active.closest('aside[aria-label="Bagian"]') !== null &&
        active.textContent?.includes('Pendidikan') === true
      )
    })
  }
  expect(reachedRail, 'Tab harus mencapai daftar bagian').toBe(true)

  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Pendidikan', level: 1 })).toBeVisible()
})

test('judul dan template bertahan setelah reload (local-first)', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Ubah judul CV/ }).click()
  await page.getByLabel('Judul dokumen').fill('CV Produk')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status', { name: 'Status penyimpanan' })).toContainText(
    'Disimpan di perangkat',
  )

  await page.reload()
  await expect(page.getByRole('button', { name: /Ubah judul CV/ })).toContainText('CV Produk')
})

test('rute §5.1 bisa dibuka dan tidak ada yang 404 di shell', async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route.path)
    if (route.heading) {
      await expect(page.getByRole('heading', { name: route.heading, level: 1 })).toBeVisible()
    } else {
      await expect(page.getByRole('main', { name: 'Ruang kerja CV' })).toBeVisible()
    }
  }

  await page.goto('/alamat-yang-tidak-ada')
  await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible()
})

test('CLS shell tetap 0 dan reduced-motion mematikan animasi', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()

  const cls = await collectCls(page)
  console.log(`CLS shell = ${cls.toFixed(4)}`)
  expect(cls).toBeLessThanOrEqual(0.0001)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  const duration = await page
    .locator('[data-probe="preview-renderer"]')
    .evaluate((element) => getComputedStyle(element).animationDuration)
  expect(parseFloat(duration)).toBeLessThan(0.01)
})
