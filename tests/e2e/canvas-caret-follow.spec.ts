import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-caret-follow.spec.ts — FASE 14 — **kamera mengikuti caret**.
 *
 * Di layar sempit (panel mode `tabs`, <1024px) kertas A4 selalu lebih lebar
 * daripada layar, jadi mengetik panjang membuat teks keluar layar — dan
 * browser lalu menggulir *isi* input supaya caret tetap terlihat (teks
 * meluncur di dalam kotak yang diam). FASE 14 membuat kamera **mengikuti
 * caret**: tiap ketikan diukur, dan kertas digeser sedikit demi sedikit
 * supaya caret selalu terlihat.
 *
 * Yang diuji:
 *  1. **posisi awal** (regresi FASE 14B + Addendum FASE 14): skala 75%, tepi
 *     kiri kertas masih punya ruang di kiri layar (tidak menempel/dipotong),
 *     dan field yang diedit tetap terlihat;
 *  2. **mengikuti ke kanan**: `scrollLeft` naik bertahap, sementara isi input
 *     tetap diam (`control.scrollLeft === 0`) — yang bergerak adalah kamera,
 *     bukan teks di dalam kotak;
 *  3. **penghujung kertas**: kamera mentok di batas gulir;
 *  4. **wrap balik ke kiri**: saat teks membungkus, caret melompat ke kiri dan
 *     kamera ikut kembali — editor tetap terlihat di area well;
 *  5. **gulir manual** (K6): ketikan pertama diabaikan, ketikan kedua
 *     diikuti lagi;
 *  6. **Escape** (regresi Addendum FASE 13): sesi ditutup → zoom kembali ke
 *     skala ringkasan.
 *
 * Spec ini khusus mobile: di desktop follow tidak pernah dinyalakan (K8).
 */

/**
 * Padding well `p-6` (24px) — jarak minimum tepi kiri kertas dari tepi kiri
 * konten well saat sesi edit. Cerminan `FOCUS_EDGE_MARGIN_PX` di
 * `src/features/canvas/canvasEditZoom.ts`. Disalin literal supaya spec e2e
 * tidak menarik modul aplikasi ke runner.
 */
const FOCUS_EDGE_MARGIN_PX = 24

/** Lebar minimum tepi kiri field yang harus tetap terlihat. */
const FIELD_VISIBLE_MIN_PX = 80

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

/** Skala yang benar-benar dipakai pohon pratinjau. */
const scaleOf = (page: Page) =>
  page.evaluate(() => {
    const content = document.querySelector('[data-probe="preview-content"]')
    if (!content) return 1
    const match = /^matrix\(([^,]+)/.exec(getComputedStyle(content).transform)
    return match ? Number(match[1]) : 1
  })

/** Persentase zoom yang tampil di toolbar. */
const zoomLabel = (page: Page) => page.locator('[data-probe="zoom-value"]').innerText()

/** Posisi gulir horizontal lapisan kertas. */
const scrollLeftOf = (page: Page) =>
  page.evaluate(
    () => document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')?.scrollLeft ?? 0,
  )

/** Batas gulir horizontal lapisan kertas. */
const maxScrollOf = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
    return scroller ? scroller.scrollWidth - scroller.clientWidth : 0
  })

/** Gulir internal isi control — harus 0 selama kamera belum mentok. */
const innerScrollOf = (page: Page) =>
  page.evaluate(
    () => document.querySelector<HTMLInputElement>('#pane-preview .canvas-editor')?.scrollLeft ?? 0,
  )

/** Kotak editor di layar — untuk memastikan editor masih terlihat. */
const editorBox = (page: Page) =>
  page.evaluate(() => {
    const editor = document.querySelector('#pane-preview .canvas-editor')
    const well = document.querySelector('#pane-preview')
    if (!editor || !well) return null
    const rect = editor.getBoundingClientRect()
    const wellRect = well.getBoundingClientRect()
    return {
      left: rect.left,
      right: rect.right,
      wellLeft: wellRect.left,
      wellRight: wellRect.right,
    }
  })

/** Set zoom ke angka pasti (bukan "Fit") lewat tombol Perkecil. */
const setZoomPercent = async (page: Page, percent: number): Promise<void> => {
  await page.locator('[data-probe="zoom-value"]').click()
  await page
    .locator('[data-slot="popover-content"]')
    .getByRole('button', { name: '50%', exact: true })
    .click()
  await page.keyboard.press('Escape')
  // 50% → target lewat tombol Perkecil (langkah 10%).
  const steps = (50 - percent) / 10
  for (let index = 0; index < steps; index += 1) {
    await page.getByRole('button', { name: 'Perkecil' }).click()
  }
  await expect.poll(() => zoomLabel(page)).toBe(`${percent}%`)
}

/** Buka sesi edit pada sebuah field dan tunggu editor-nya tampil. */
const openField = async (page: Page, field: string) => {
  await page.locator(`#pane-preview [data-field="${field}"]`).click()
  const editor = page.locator('#pane-preview .canvas-editor')
  await expect(editor).toBeVisible()
  await page.waitForTimeout(300)
  return editor
}

test.describe('kamera mengikuti caret di layar sempit (FASE 14)', () => {
  test('teks membungkus → kamera kembali, lalu mengetik lagi → kamera ikut ke kanan', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'summary.text')

    // Baris pertama terisi penuh → caret di kanan, kamera menyusul.
    await editor.pressSequentially('d'.repeat(70))
    await page.waitForTimeout(700)
    const peak = await scrollLeftOf(page)
    expect(peak).toBeGreaterThan(0)

    // Teks berikutnya membungkus → caret melompat ke kiri, kamera kembali ke
    // pendaratan awal sesi.
    await editor.pressSequentially('e'.repeat(70))
    await page.waitForTimeout(900)
    const afterWrap = await scrollLeftOf(page)
    expect(afterWrap).toBeLessThan(peak)

    // **Regresi:** setelah wrap, mengetik lagi harus kembali menggeser kamera
    // ke kanan. Jangkar "kembali ke awal" tidak boleh menggantung — begitu
    // kamera sampai (mentok beberapa piksel di atas target karena scroll
    // browser dibulatkan), jangkar dilepas dan pita gerak aktif lagi.
    await editor.pressSequentially('f'.repeat(40))
    await page.waitForTimeout(900)
    const afterTyping = await scrollLeftOf(page)
    expect(
      afterTyping,
      'kamera harus kembali mengikuti caret ke kanan setelah wrap',
    ).toBeGreaterThan(afterWrap)
  })

  test('posisi awal: skala 75%, kertas punya ruang kiri, field tetap terlihat', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)

    const paper = await page.evaluate(() => {
      const element = document.querySelector('#pane-preview [data-field="profile.fullName"]')
      const content = document.querySelector('[data-probe="preview-content"]')
      if (!element || !content) return null
      const scale = new DOMMatrix(getComputedStyle(content).transform).a || 1
      const rect = element.getBoundingClientRect()
      const contentRect = content.getBoundingClientRect()
      return { x: (rect.left - contentRect.left) / scale }
    })
    expect(paper).not.toBeNull()

    await openField(page, 'profile.fullName')

    await expect.poll(() => scaleOf(page)).toBeCloseTo(0.75, 2)

    // Addendum FASE 14 — tepi kiri KERTAS masih punya ruang di kiri layar
    // (tidak menempel/dipotong di tepi), dan field yang diedit tetap
    // terlihat.
    const landed = await page.evaluate((paperX) => {
      const content = document.querySelector('[data-probe="preview-content"]')
      const well = document.querySelector('#pane-preview')
      if (!content || !well) return null
      const scale = new DOMMatrix(getComputedStyle(content).transform).a || 1
      const contentRect = content.getBoundingClientRect()
      const wellRect = well.getBoundingClientRect()
      const borderLeft = Number.parseFloat(getComputedStyle(well).borderLeftWidth) || 0
      return {
        paperLeft: contentRect.left,
        fieldLeft: contentRect.left + paperX * scale,
        wellLeft: wellRect.left + borderLeft,
      }
    }, paper!.x)
    expect(landed).not.toBeNull()
    expect(
      landed!.paperLeft - landed!.wellLeft,
      'tepi kiri kertas masih punya ruang di kiri layar',
    ).toBeGreaterThanOrEqual(FOCUS_EDGE_MARGIN_PX - 2)
    expect(landed!.fieldLeft - landed!.wellLeft, 'field yang diedit tetap terlihat').toBeLessThan(
      page.viewportSize()!.width - FIELD_VISIBLE_MIN_PX + 2,
    )
  })

  test('mengetik → kamera mengikuti ke kanan, isi input tetap diam', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'profile.fullName')

    const start = await scrollLeftOf(page)

    // Teks sepanjang dua kali lebar layar — kamera harus menyusul.
    await editor.pressSequentially('a'.repeat(30))
    await expect.poll(() => scrollLeftOf(page)).toBeGreaterThan(start)
    const first = await scrollLeftOf(page)

    await editor.pressSequentially('b'.repeat(10))
    await expect.poll(() => scrollLeftOf(page)).toBeGreaterThan(first)
    const second = await scrollLeftOf(page)

    // Kamera bergerak, isi input tidak: selama kamera belum mentok, teks
    // di dalam kotak tetap diam (tidak "meluncur" sendiri).
    expect(await innerScrollOf(page)).toBe(0)
    expect(second).toBeGreaterThan(first)
  })

  test('di penghujung kertas kamera mentok di batas gulir', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'profile.fullName')

    await editor.pressSequentially('c'.repeat(120))

    // Kamera mentok di batas gulir lapisan kertas (selisih beberapa piksel
    // masih mungkin karena caret diukur ulang saat browser menggulir isi
    // input).
    const limit = await maxScrollOf(page)
    await expect.poll(() => scrollLeftOf(page)).toBeGreaterThan(limit - 8)
    expect(await scrollLeftOf(page)).toBeLessThanOrEqual(limit)

    // Setelah mentok, kamera tidak terus bergerak.
    const settled = await scrollLeftOf(page)
    await editor.pressSequentially('d'.repeat(20))
    await page.waitForTimeout(600)
    expect(await scrollLeftOf(page)).toBeLessThanOrEqual(limit)
    expect(await scrollLeftOf(page)).toBeGreaterThan(limit - 8)
    expect(settled).toBeGreaterThan(limit - 8)
  })

  test('teks membungkus → caret kembali ke kiri, kamera ikut kembali', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'summary.text')

    // Baris pertama textarea terisi penuh → caret di kanan, kamera menyusul.
    const before = await scrollLeftOf(page)
    await editor.pressSequentially('d'.repeat(70))
    await page.waitForTimeout(700)
    const peak = await scrollLeftOf(page)
    expect(peak).toBeGreaterThan(before)

    // Teks berikutnya membungkus ke baris kedua → caret melompat ke kiri.
    await editor.pressSequentially('e'.repeat(70))
    await page.waitForTimeout(900)

    expect(await scrollLeftOf(page)).toBeLessThan(peak)

    // Editor sendiri tetap terlihat di area well.
    const box = await editorBox(page)
    expect(box).not.toBeNull()
    expect(box!.right).toBeGreaterThan(box!.wellLeft)
    expect(box!.left).toBeLessThan(box!.wellRight)
  })

  test('gulir manual: ketikan pertama diabaikan, ketikan kedua diikuti lagi', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'profile.fullName')

    // Teks cukup panjang supaya kamera benar-benar bergerak, lalu caret
    // berhenti di ambang kanan pita.
    await editor.pressSequentially('f'.repeat(30))
    await page.waitForTimeout(700)
    const peak = await scrollLeftOf(page)
    expect(peak).toBeGreaterThan(0)

    // Gulir manual user (di luar flag programmatic follow) — kamera digeser
    // ke kiri sedikit, caret keluar pita tapi tetap terlihat di layar.
    await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>('[data-probe="preview-scroll"]')
      if (scroller) scroller.scrollLeft -= 30
    })
    await page.waitForTimeout(400)
    const manual = await scrollLeftOf(page)
    expect(manual).toBeLessThan(peak)

    // Ketikan pertama: follow baru dinyalakan, gerakannya belum ikut.
    await editor.pressSequentially('g')
    await page.waitForTimeout(700)
    const ignored = await scrollLeftOf(page)
    expect(Math.abs(ignored - manual)).toBeLessThan(2)

    // Ketikan kedua: kamera mengejar lagi.
    await editor.pressSequentially('h')
    await expect.poll(() => scrollLeftOf(page)).toBeGreaterThan(ignored)
  })

  test('Escape menutup sesi → zoom kembali ke skala ringkasan', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    // Zoom ringkasan 30% — kondisi nyata di layar kecil.
    await setZoomPercent(page, 30)
    expect(await scaleOf(page)).toBeCloseTo(0.3, 2)

    const editor = await openField(page, 'profile.fullName')
    await expect.poll(() => scaleOf(page)).toBeCloseTo(0.75, 2)

    await editor.press('Escape')
    await expect(page.locator('#pane-preview .canvas-editor')).toHaveCount(0)
    await expect.poll(() => scaleOf(page)).toBeCloseTo(0.3, 2)
    await expect.poll(() => zoomLabel(page)).toBe('30%')
  })

  test('mirror caret tidak terbaca pembaca layar & axe bersih', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'profile.fullName')
    await editor.pressSequentially('zx')
    await page.waitForTimeout(400)

    // Mirror pengukuran caret ada di DOM, tapi tersembunyi dari pembaca layar
    // (aria-hidden + visibility hidden).
    const mirror = await page.evaluate(() => {
      const node = document.querySelector('[data-probe="caret-mirror"]')
      if (!node) return null
      return {
        ariaHidden: node.getAttribute('aria-hidden'),
        visibility: getComputedStyle(node).visibility,
      }
    })
    expect(mirror).not.toBeNull()
    expect(mirror!.ariaHidden).toBe('true')
    expect(mirror!.visibility).toBe('hidden')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact ?? 'unknown'),
    )
    expect(violations.map((v) => `${v.impact}/${v.id}`)).toEqual([])
  })

  test('ketik 200 karakter di 360px: kamera tetap di ujung, isi input jadi cadangan', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 360, height: 640 })
    await startApp(page)
    await toCanvasMode(page)
    const editor = await openField(page, 'profile.fullName')

    const start = await scrollLeftOf(page)
    await editor.pressSequentially('x'.repeat(200))
    await page.waitForTimeout(900)

    // Kamera bergerak mengikuti caret…
    expect(await scrollLeftOf(page)).toBeGreaterThan(start)
    // …dan di ujung kertas browser yang menggulir isi input sebagai cadangan.
    expect(await innerScrollOf(page)).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })
})
