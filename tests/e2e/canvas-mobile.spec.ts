import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-mobile.spec.ts — FASE 12 / C5.1 (§5.3)
 *
 * Kanvas yang usable di Pixel 7 (project mobile-chrome):
 *  - badge tab Pratinjau saat mode kanvas aktif (D2);
 *  - target sentuh: area hit segmen ≥32px, ghost row 44px;
 *  - editor tanggal sebagai Sheet bawah (pola sticky action bar), bukan
 *    popover melayang — kontrol & probe sama dengan desktop;
 *  - menu Tampilan = entri di sheet MobileMenu.
 *
 * FASE 13 / Fase 4 — mode "kertas layar penuh" di mobile & tablet:
 *  - tab bar hilang, tinggi workspace pas, tidak ada celah di bawah kertas;
 *  - toolbar kanvas muat di kotak konten well (tombol "Tampilan" & "Keluar"
 *    tidak boleh terpotong);
 *  - aturan target sentuh & pinch-zoom tetap berlaku;
 *  - sheet "Bagian" di atas StickyActionBar, dan rotasi portrait ↔ landscape.
 */

const startApp = async (page: Page): Promise<void> => {
  await page.goto('/')
  await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await page.getByRole('tab', { name: /Pratinjau/ }).click()
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
    timeout: 10_000,
  })
}

/** startApp dengan viewport tertentu (rotasi & layar pendek). */
const startAppAt = async (page: Page, width: number, height: number): Promise<void> => {
  await page.setViewportSize({ width, height })
  await startApp(page)
}

const toCanvasMode = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  await page.keyboard.press('Escape')
}

test.describe('kanvas mobile (C5.1, §5.3)', () => {
  test('mode kanvas: tab bar hilang, kertas langsung jadi satu pane (§4, D1)', async ({ page }) => {
    await startApp(page)

    // Sebelum masuk mode kanvas, tab bar mobile masih ada (mode form).
    await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toBeVisible()

    await toCanvasMode(page)

    // FASE 13 (D1, §4) — mode kanvas = satu pane penuh: tab bar tidak
    // dirender, rail & formulir disembunyikan, kertas mengisi lebar layar.
    await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toHaveCount(0)
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeHidden()
    await expect(page.locator('#pane-form')).toBeHidden()
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()

    // Kertas bukan lagi separuh workspace — well pratinjau selebar layar.
    const wellWidth = await page.locator('#pane-preview').evaluate((el) => el.clientWidth)
    const viewportWidth = page.viewportSize()?.width ?? 0
    expect(wellWidth).toBeGreaterThan(viewportWidth * 0.9)

    // Kembali ke mode form: tab bar kembali, kertas disembunyikan lagi.
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.locator('[data-probe="edit-mode-form"]').click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toBeVisible()
  })

  test('target sentuh: segmen ≥32px dan ghost row 44px (ruang kertas)', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Kertas diproyeksikan dengan transform scale (fit mode default, D2) —
    // nilai 32/44 §5.3 adalah ukuran pada RUANG KERTAS (zoom 100%), jadi
    // pengukuran dibagi skala paper sekarang.
    const paperScale = await page.locator('[data-probe="preview-content"]').evaluate((el) => {
      const style = getComputedStyle(el)
      return style.transform && style.transform !== 'none'
        ? Math.abs(new DOMMatrix(style.transform).a)
        : 1
    })
    expect(paperScale).toBeGreaterThan(0)

    // Tidak ada klik segmen di sini supaya zoom tetap pada skala awal (D7
    // hanya naik saat interaksi; pengukuran tetap netral terhadap D7).
    const segments = await page
      .locator('#pane-preview [data-canvas-field]')
      .evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect()
          const style = getComputedStyle(el)
          return {
            height: rect.height,
            paddingY: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom),
          }
        }),
      )
    expect(segments.length, 'dokumen contoh punya segmen kanvas').toBeGreaterThan(0)
    for (const { height, paddingY } of segments) {
      // Area hit ≥32px: padding transparan melebar tanpa mengubah tinggi baris
      // teks (tombol inline non-replaced), jadi pagination kertas tak berubah.
      // (pembulatan 2 desimal menghilangkan noise float dari pembagian skala.)
      const paperHeight = Math.round((height / paperScale) * 100) / 100
      expect(paperHeight, 'area hit segmen (ruang kertas)').toBeGreaterThanOrEqual(32)
      expect(paddingY, 'padding transparan §5.3').toBeGreaterThanOrEqual(20)
    }

    const ghosts = await page
      .locator('#pane-preview [data-canvas-ghost]')
      .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height))
    expect(ghosts.length, 'ghost row tersedia di dokumen contoh').toBeGreaterThan(0)
    for (const height of ghosts) {
      expect(
        Math.round((height / paperScale) * 100) / 100,
        'ghost row target sentuh',
      ).toBeGreaterThanOrEqual(44)
    }
  })

  test('editor tanggal terbuka sebagai Sheet bawah dan commit lewat Simpan', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Ambil ENTRI TERAKHIR yang tanggalnya sudah selesai (bukan "SEKARANG"),
    // supaya kedua input bulan bisa diisi.
    await page
      .locator('#pane-preview [data-field^="entries.experience"][data-field$=".dates"]')
      .last()
      .click()

    const panel = page.locator('[data-probe="canvas-dates"]')
    await expect(panel).toBeVisible()
    // Varian mobile = Sheet bawah (bukan popover melayang).
    await expect(panel).toHaveAttribute('data-side', 'bottom')

    const months = panel.locator('input[type="month"]')
    await expect(months.first()).toBeVisible()
    await expect(months.nth(1)).toBeEnabled()
    await months.nth(0).fill('2018-07')
    await months.nth(1).fill('2024-05')
    await panel.getByRole('button', { name: 'Simpan' }).click()

    await expect(panel).toHaveCount(0)
    await expect(
      page.locator('#pane-preview [data-field^="entries.experience"][data-field$=".dates"]').last(),
    ).toContainText('Jul 2018')
  })

  test('menu Tampilan mobile: mode kanvas, toggle pratinjau, dan preset zoom dalam satu sheet', async ({
    page,
  }) => {
    await startApp(page)

    await page.getByRole('button', { name: 'Menu' }).click()
    const sheetBody = page.locator('[data-slot="sheet-content"]')

    // Mode pengerjaan (D2) — radiogroup probe yang sama dengan popover desktop.
    const group = page.locator('[data-probe="edit-mode"]:visible')
    await expect(group).toBeVisible()
    await expect(group.locator('[data-probe="edit-mode-canvas"]')).toBeVisible()
    await sheetBody.locator('[data-probe="edit-mode-canvas"]').click()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')

    // Toggle pratinjau & preset zoom ikut tersedia (isi TampilanMenuContent).
    // `exact` wajib: di mode kanvas ada preset 150% yang teksnya memuat "50%".
    await expect(sheetBody.getByRole('switch').first()).toBeVisible()
    await expect(sheetBody.getByRole('radio', { name: '50%', exact: true })).toBeAttached()
    await expect(sheetBody.getByRole('radio', { name: '100%', exact: true })).toBeAttached()

    await page.keyboard.press('Escape')
    // FASE 13 — di mode kanvas tidak ada tab bar; kertas tetap satu pane.
    await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toHaveCount(0)
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
  })
})

/**
 * FASE 13 / Fase 4 — "kertas layar penuh" di mobile & tablet.
 *
 * T4.1 — tab bar hilang, tinggi workspace = `100dvh` − TopBar, tidak ada celah
 *        di bawah kertas dan tidak ada elemen yang tertutup `StickyActionBar`;
 *        toolbar kanvas harus muat di kotak konten well supaya tombol
 *        "Tampilan" & "Keluar" (dua jalan keluar) tidak terpotong.
 * T4.2 — aturan target sentuh §5.3 tetap aktif, pinch-zoom tidak diblokir,
 *        dan guard zoom menaikkan skala ke 75% saat skala fit < 60%.
 * T4.3 — sheet "Bagian" berada di atas `StickyActionBar`; rotasi portrait ↔
 *        landscape tidak mengubah jumlah kolom grid.
 */
test.describe('kertas layar penuh di mobile & tablet (FASE 13 Fase 4)', () => {
  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ]) {
    test(`${size.width}×${size.height}: tinggi pas, tanpa celah, toolbar tidak terpotong`, async ({
      page,
    }) => {
      await startAppAt(page, size.width, size.height)
      await toCanvasMode(page)

      // T4.1 — tab bar hilang (tab bar 44px itu yang dikurangi dari tinggi).
      await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toHaveCount(0)

      const metrics = await page.evaluate(() => {
        const workspace = document.querySelector('#workspace-main > div')
        const well = document.querySelector('#pane-preview')
        const bar = [...document.querySelectorAll('div')].find((el) => {
          const style = getComputedStyle(el)
          return (
            style.position === 'fixed' &&
            style.zIndex === '30' &&
            style.display !== 'none' &&
            el.querySelector('[data-probe="download-pdf"]')
          )
        })
        if (!workspace || !well) throw new Error('elemen workspace tidak ditemukan')
        const toolbar = well.querySelector('.bg-toolbar-glass')
        if (!toolbar) throw new Error('toolbar pratinjau tidak ditemukan')
        return {
          innerHeight: window.innerHeight,
          innerWidth: window.innerWidth,
          workspaceHeight: Math.round(workspace.getBoundingClientRect().height),
          workspacePaddingBottom: getComputedStyle(workspace).paddingBottom,
          wellBottom: Math.round(well.getBoundingClientRect().bottom),
          wellOverflowX: well.scrollWidth - well.clientWidth,
          barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null,
          barHeight: bar ? Math.round(bar.getBoundingClientRect().height) : null,
          toolbarLeft: Math.round(toolbar.getBoundingClientRect().left),
          toolbarRight: Math.round(toolbar.getBoundingClientRect().right),
        }
      })

      // Tinggi = 100dvh − TopBar 52px (tab bar sudah tidak ada).
      expect(metrics.workspaceHeight).toBe(metrics.innerHeight - 52)
      // Ruang untuk StickyActionBar (64px) tetap disisihkan.
      expect(metrics.workspacePaddingBottom).toBe('64px')
      // Bawah kertas tepat di tepi bar bawah: tanpa celah, tanpa tertimpa.
      expect(metrics.barTop).not.toBeNull()
      expect(metrics.barHeight).toBe(64)
      expect(metrics.wellBottom, 'ada celah di bawah kertas').toBe(metrics.barTop)
      // Toolbar tidak meluber: tidak ada scroll horizontal di dalam well.
      expect(metrics.wellOverflowX).toBeLessThanOrEqual(0)
      expect(metrics.toolbarLeft).toBeGreaterThanOrEqual(0)
      expect(metrics.toolbarRight).toBeLessThanOrEqual(metrics.innerWidth)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(0)

      // Dua jalan keluar dari mode kanvas benar-benar terlihat & bisa diklik.
      const exit = page.locator('[data-probe="canvas-exit"]')
      await expect(exit).toBeVisible()
      await expect(page.locator('[data-probe="tampilan-menu"]')).toBeVisible()
      await exit.click()
      // Keluar layar penuh → tab bar kembali, mode tetap "Langsung di CV".
      // Rail adalah elemen desktop (`hidden ... lg:flex`), jadi di <1024px ia
      // memang tidak pernah tampil — yang diperiksa adalah kembalinya tab
      // bar dan panel formulir yang bisa dibuka lagi.
      await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toHaveCount(1)
      await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
      await page.getByRole('tab', { name: 'Isi data' }).click()
      await expect(page.locator('#pane-form')).toBeVisible()

      await page.screenshot({ path: `artifacts/fase13-f4/canvas-full-${size.width}.png` })
    })
  }

  test('T4.2: aturan target sentuh §5.3 tetap aktif di mode kanvas layar penuh', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Hook CSS bergantung pada `data-panel-mode`, yang di fase ini tidak
    // berubah: di <1024px mode panel tetap 'tabs'.
    await expect(page.locator('[data-panel-mode]')).toHaveAttribute('data-panel-mode', 'tabs')
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')

    const paddings = await page
      .locator('#pane-preview [data-canvas-field]')
      .evaluateAll((elements) =>
        elements.map((el) => {
          const style = getComputedStyle(el)
          return parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
        }),
      )
    expect(paddings.length, 'dokumen contoh punya segmen kanvas').toBeGreaterThan(0)
    for (const padding of paddings) {
      expect(padding, 'padding transparan §5.3').toBeGreaterThanOrEqual(20)
    }
  })

  test('T4.2: pinch-zoom tidak diblokir oleh well pratinjau', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    const touchAction = await page
      .locator('#pane-preview')
      .evaluate((el) => getComputedStyle(el).touchAction)
    // Chrome menormalkan `pan-x pan-y pinch-zoom` menjadi `manipulation`
    // (setara menurut CSS Touch Action Level 2). Yang penting: BUKAN `none`,
    // karena `none` mematikan pinch-zoom.
    expect(touchAction).not.toBe('none')
    expect(['manipulation', 'pan-x pan-y pinch-zoom']).toContain(touchAction)
  })

  test('T4.2: guard zoom menaikkan skala ke 75% saat skala fit < 60%', async ({ page }) => {
    await startAppAt(page, 360, 640)
    await toCanvasMode(page)

    const scaleOf = () =>
      page.evaluate(() => {
        const content = document.querySelector('[data-probe="preview-content"]')
        if (!content) return 1
        const match = /^matrix\(([^,]+)/.exec(getComputedStyle(content).transform)
        return match ? Number(match[1]) : 1
      })

    // Di 360px skala fit = (360−48)/794 ≈ 0,39 → di bawah ambang keterbacaan.
    const fit = await scaleOf()
    expect(fit).toBeLessThan(0.6)

    // Menyentuh segmen kanvas membuka sesi edit → guard menaikkan skala.
    await page.locator('#pane-preview [data-canvas-field]').first().click()
    await expect.poll(scaleOf, { message: 'skala tidak naik ke 75%' }).toBeCloseTo(0.75, 2)
    // Tanpa toast: di mobile toast duduk tepat di atas field yang sedang
    // diedit, jadi ia menutupi teks yang diketik (addendum FASE 13).
    // Nilai zoom di toolbar yang memberi tahu.
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    await expect(page.locator('[data-probe="zoom-value"]')).toHaveText('75%')
  })

  test('T4.3: sheet "Bagian" berada di atas StickyActionBar', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await page.locator('[data-probe="canvas-sections-menu"]').click()
    const sheet = page.locator('[data-slot="sheet-content"]')
    await expect(sheet).toBeVisible()
    // Bentuk sheet bawah (bukan popover) — preseden StickyActionBar.
    await expect(sheet).toHaveAttribute('data-side', 'bottom')

    const layers = await page.evaluate(() => {
      const sheetEl = document.querySelector('[data-slot="sheet-content"]')
      const bar = [...document.querySelectorAll('div')].find((el) => {
        const style = getComputedStyle(el)
        return (
          style.position === 'fixed' &&
          style.zIndex === '30' &&
          style.display !== 'none' &&
          el.querySelector('[data-probe="download-pdf"]')
        )
      })
      return {
        sheetZ: sheetEl ? Number(getComputedStyle(sheetEl).zIndex) : null,
        barZ: bar ? Number(getComputedStyle(bar).zIndex) : null,
        sheetBottom: sheetEl ? Math.round(sheetEl.getBoundingClientRect().bottom) : null,
        barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null,
      }
    })
    expect(layers.sheetZ).not.toBeNull()
    expect(layers.barZ).not.toBeNull()
    // Sheet di atas bar (z-50 vs z-30) dan menutupi bar sepenuhnya.
    expect(layers.sheetZ!).toBeGreaterThan(layers.barZ!)
    expect(layers.sheetBottom).toBeGreaterThanOrEqual(layers.barTop!)

    await page.screenshot({ path: 'artifacts/fase13-f4/canvas-sheet-bagian.png' })
  })

  test('T4.3: rotasi portrait ↔ landscape tidak mengubah jumlah kolom grid', async ({ page }) => {
    await startAppAt(page, 390, 844)
    await toCanvasMode(page)

    const measure = async () =>
      page.evaluate(() => {
        const workspace = document.querySelector('#workspace-main > div')
        if (!workspace) throw new Error('grid workspace tidak ditemukan')
        return {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          columns: getComputedStyle(workspace).gridTemplateColumns.split(' ').filter(Boolean)
            .length,
          workspaceHeight: Math.round(workspace.getBoundingClientRect().height),
          hOverflow: document.documentElement.scrollWidth - window.innerWidth,
        }
      })

    const portrait = await measure()
    expect(portrait.columns, 'grid tetap satu kolom').toBe(1)
    expect(portrait.workspaceHeight).toBe(portrait.innerHeight - 52)
    expect(portrait.hOverflow).toBeLessThanOrEqual(0)

    // Putar ke lanskap: `100dvh` ikut berubah, jumlah kolom tetap satu.
    await page.setViewportSize({ width: 844, height: 390 })
    await page.waitForTimeout(400)
    const landscape = await measure()
    expect(landscape.columns, 'grid tetap satu kolom setelah rotasi').toBe(1)
    expect(landscape.workspaceHeight).toBe(landscape.innerHeight - 56)
    expect(landscape.hOverflow).toBeLessThanOrEqual(0)
    await expect(page.getByRole('tablist', { name: 'Mode tampilan' })).toHaveCount(0)
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()

    // Kembali ke potret: tetap satu pane, tanpa celah baru.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
    const back = await measure()
    expect(back.columns).toBe(1)
    expect(back.workspaceHeight).toBe(back.innerHeight - 52)
    expect(back.hOverflow).toBeLessThanOrEqual(0)
  })
})
