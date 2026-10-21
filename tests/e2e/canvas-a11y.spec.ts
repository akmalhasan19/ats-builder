import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-a11y.spec.ts — FASE 12 / C5.4 (D11, P8)
 *
 * Aksesibilitas kanvas adalah floor, bukan tambahan:
 *  - navigasi keyboard penuh tanpa mouse: Tab masuk ke segmen pertama, Enter
 *    membuka editor, Enter commit, fokus kembali ke pemicu, Tab lanjut ke
 *    segmen berikutnya, Ctrl+Z membatalkan satu commit;
 *  - live region mengumumkan pergantian mode pengerjaan;
 *  - prefers-reduced-motion mematikan motion affordance kanvas;
 *  - axe 0 violation critical/serious di mode kanvas (mode form diaudit
 *    `a11y.spec.ts`).
 *
 * FASE 13 / Fase 5 — mode "kertas layar penuh":
 *  - fokus berpindah ke kertas saat masuk mode kanvas (D13);
 *  - urutan Tab toolbar kanvas tetap logis;
 *  - tidak ada elemen `display:none` (atau `aria-hidden`) yang memegang fokus;
 *  - skip link tetap bermakna saat rail & formulir tersembunyi;
 *  - kontras toolbar kaca di atas well yang jauh lebih lebar tetap memadai.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024

const segments = (page: Page) => page.locator('#pane-preview [data-canvas-field]')
const editor = (page: Page) => page.locator('#pane-preview .canvas-editor')

const startApp = async (page: Page): Promise<void> => {
  if (isDesktop(page)) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    const option = page.getByRole('radio', { name: /Nanti saja/ })
    if (await option.isVisible().catch(() => false)) await option.click()
    await later.click()
  }
}

const toCanvasMode = async (page: Page): Promise<void> => {
  if (isDesktop(page)) {
    await page.locator('[data-probe="tampilan-menu"]').click()
  } else {
    await page.getByRole('button', { name: 'Menu' }).click()
  }
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  await page.keyboard.press('Escape')
  // FASE 13 (T3.3) — jangan lanjut sebelum lapisan popover/sheet benar-benar
  // tercabut: Radix mengembalikan fokus ke pemicunya SAAT unmount. Kalau tes
  // sudah memindahkan fokus lebih dulu, restore itu merebut fokus kembali ke
  // pemicu sehingga `Enter` berikutnya membuka popover, bukan editor kertas.
  await expect(
    page.locator('[data-slot="popover-content"], [data-slot="sheet-content"]'),
  ).toHaveCount(0)
  // FASE 13 (D1, §4) — di mode kanvas layar penuh tab bar mobile tidak
  // dirender lagi, jadi tidak ada tab "Pratinjau" untuk diklik.
  const tablist = page.getByRole('tablist', { name: 'Mode tampilan' })
  if (!isDesktop(page) && (await tablist.count()) > 0) {
    await page.getByRole('tab', { name: /Pratinjau/ }).click()
  }
}

test.describe('aksesibilitas kanvas (C5.4)', () => {
  test('keyboard penuh: Tab → Enter → ketik → Enter → Tab → Ctrl+Z', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    // Titik masuk keyboard: kontrol terakhir toolbar pratinjau, lalu Tab masuk
    // ke segmen pertama kertas (urutan Tab = urutan baca dokumen).
    // FASE 13 (T3.3) — kontrol terakhir toolbar kini tombol "Keluar dari layar
    // penuh" (TampilanMenu bergeser satu posisi); maksud tes tetap sama.
    await page.locator('[data-probe="canvas-exit"]').focus()
    await page.keyboard.press('Tab')
    const first = segments(page).first()
    await expect(first).toBeFocused()
    const firstField = await first.getAttribute('data-field')
    expect(firstField).toBe('profile.fullName')

    await page.keyboard.press('Enter')
    const control = editor(page)
    await expect(control).toBeFocused()

    // Ketik menggantikan teks terpilih (auto select saat sesi dibuka).
    await control.pressSequentially('Nama Keyboard')
    await control.press('Enter')
    await expect(segments(page).filter({ hasText: 'Nama Keyboard' })).toHaveCount(1)
    // D11 — fokus kembali ke tombol pemicu, bukan hilang ke body.
    await expect(first).toBeFocused()

    // Tab lanjut ke segmen berikutnya (bukan keluar dari kertas).
    await page.keyboard.press('Tab')
    const nextField = await page.evaluate(() => document.activeElement?.getAttribute('data-field'))
    expect(nextField).not.toBe(firstField)
    expect(nextField).toBeTruthy()

    // Ctrl+Z membatalkan satu commit kanvas (D9).
    await page.keyboard.press('Control+z')
    await expect(segments(page).filter({ hasText: 'Nama Keyboard' })).toHaveCount(0)
    await expect(first).toHaveText('Alex Morgan')
  })

  test('live region mengumumkan pergantian mode pengerjaan', async ({ page }) => {
    await startApp(page)

    const live = page.locator('[data-probe="edit-mode-announce"]')
    await expect(live).toHaveAttribute('aria-live', 'polite')
    await expect(live).toHaveText('Mode pengerjaan: Form terpandu.')

    await toCanvasMode(page)
    // FASE 13 (T5.2) — di mode kanvas layar penuh pengumanannya menyebut
    // "kertas layar penuh": rail & formulir hilang, kertas jadi satu pane.
    await expect(live).toHaveText('Mode langsung di CV, kertas layar penuh.')

    // Kembali ke form juga diumumkan.
    await page.locator('[data-probe="tampilan-menu"]').click()
    await page.locator('[data-probe="edit-mode-form"]').click()
    await page.keyboard.press('Escape')
    await expect(live).toHaveText('Mode pengerjaan: Form terpandu.')
  })

  test('prefers-reduced-motion: motion affordance kanvas berdurasi ~0', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await startApp(page)
    await toCanvasMode(page)

    const durations = await page.evaluate(() => {
      const nodes = [
        document.querySelector('#pane-preview [data-canvas-field]'),
        document.querySelector('#pane-preview [data-canvas-ghost]'),
        document.querySelector('#pane-preview [data-probe="page-sheet"]'),
      ]
      return nodes.map((node) => {
        if (!(node instanceof HTMLElement)) return 'missing'
        const style = getComputedStyle(node)
        return `${style.animationDuration}/${style.transitionDuration}`
      })
    })
    for (const value of durations) {
      if (value === 'missing') continue
      const numbers = value
        .split('/')
        .flatMap((part) => part.split(',').map((raw) => parseFloat(raw)))
        .filter((n) => Number.isFinite(n))
      expect(Math.max(...numbers), value).toBeLessThan(0.01)
    }
  })

  test('axe: 0 violation serius di mode kanvas (guide + ghost row)', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    await expect(segments(page).first()).toBeVisible()
    await page.waitForTimeout(400)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const violations = results.violations.filter((v) =>
      ['critical', 'serious'].includes(v.impact ?? 'unknown'),
    )
    expect(violations.map((v) => `${v.impact}/${v.id}`)).toEqual([])
  })
})

/**
 * FASE 13 — Fase 5 (T5.1/T5.4) — aksesibilitas mode "kertas layar penuh".
 */
test.describe('aksesibilitas kertas layar penuh (FASE 13 Fase 5)', () => {
  test('D13: fokus berpindah ke kertas saat masuk mode kanvas', async ({ page }) => {
    await startApp(page)

    // Sebelum masuk: fokus di pemicu menu Tampilan.
    const trigger = page.locator('[data-probe="tampilan-menu"]')
    await trigger.focus()
    await expect(trigger).toBeFocused()

    await page.locator('[data-probe="tampilan-menu"]').click()
    await page.locator('[data-probe="edit-mode-canvas"]').click()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')

    // Kertas jadi satu-satunya area kerja → fokus pindah ke sana, bukan ke
    // `<body>` (jebakan fokus §1.2).
    await expect(page.locator('#pane-preview')).toBeFocused()
  })

  test('D13: keluar dari layar penuh mengembalikan fokus ke pemicu', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await page.locator('[data-probe="canvas-exit"]').focus()
    await page.locator('[data-probe="canvas-exit"]').click()
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible()

    // Tombol "Keluar" sudah tidak ada (hanya di mode kanvas layar penuh) →
    // fokus tidak boleh jatuh ke `<body>`.
    const active = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return 'body'
      return el.getAttribute('data-probe') ?? el.tagName
    })
    expect(active, 'fokus jatuh ke body').not.toBe('body')
  })

  test('tab order toolbar kanvas: zoom → halaman → penggaris → stabilo → Bagian → Tampilan → Keluar', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)

    const order = await page.evaluate(() => {
      const toolbar = document.querySelector('#pane-preview .bg-toolbar-glass')
      if (!toolbar) return []
      const probes = [
        'zoom-value',
        'page-counter',
        'preview-highlighter',
        'canvas-sections-menu',
        'tampilan-menu',
        'canvas-exit',
      ]
      const labels = ['Perkecil', 'Perbesar', 'Penggaris margin']
      return Array.from(toolbar.querySelectorAll<HTMLElement>('*'))
        .filter((el) => {
          const probe = el.getAttribute('data-probe')
          const label = el.getAttribute('aria-label')
          return Boolean((probe && probes.includes(probe)) || (label && labels.includes(label)))
        })
        .map((el) => el.getAttribute('data-probe') ?? el.getAttribute('aria-label'))
    })

    expect(order).toEqual([
      'Perkecil',
      'zoom-value',
      'Perbesar',
      'page-counter',
      'Penggaris margin',
      'preview-highlighter',
      'canvas-sections-menu',
      'tampilan-menu',
      'canvas-exit',
    ])
  })

  test('tidak ada elemen tersembunyi yang memegang fokus setelah toggle', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    const audit = await page.evaluate(() => {
      const active = document.activeElement
      const activeVisible =
        !active || active === document.body
          ? true
          : typeof active.checkVisibility === 'function'
            ? active.checkVisibility()
            : true

      // Elemen di form/rail yang disembunyikan tidak boleh bisa difokuskan.
      const hidden = document.querySelector<HTMLElement>('#pane-form button')
      const before = document.activeElement
      hidden?.focus()
      const hiddenTookFocus = document.activeElement === hidden

      // "aria-hidden focus": container aria-hidden tidak boleh memuat kontrol
      // yang bisa difokuskan.
      const ariaHiddenFocusable = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-hidden="true"]'),
      )
        .filter((el) => el.querySelector('button, a[href], input, select, textarea, [tabindex]'))
        .map((el) => el.getAttribute('data-probe') ?? el.className)

      return {
        activeVisible,
        hiddenTookFocus,
        ariaHiddenFocusable,
        activeIsBody: before === document.body,
      }
    })

    expect(audit.activeVisible, 'elemen yang difokuskan terlihat').toBe(true)
    expect(audit.hiddenTookFocus, 'elemen tersembunyi bisa difokuskan').toBe(false)
    expect(audit.ariaHiddenFocusable, 'aria-hidden berisi kontrol fokus').toEqual([])
  })

  test('skip link tetap bermakna saat rail & formulir tersembunyi', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    const skip = page.locator('a[href="#workspace-main"]')
    await expect(skip).toBeAttached()

    const target = await page.evaluate(() => {
      const main = document.getElementById('workspace-main')
      const preview = document.getElementById('pane-preview')
      return {
        mainVisible: main ? main.checkVisibility() : false,
        holdsPreview: Boolean(main && preview && main.contains(preview)),
        railVisible: Boolean(
          document.querySelector('aside[aria-label="Bagian"]')?.checkVisibility(),
        ),
        formVisible: Boolean(document.getElementById('pane-form')?.checkVisibility()),
      }
    })
    expect(target.mainVisible, 'tujuan skip link terlihat').toBe(true)
    expect(target.holdsPreview, 'tujuan skip link memuat kertas').toBe(true)
    expect(target.railVisible, 'rail tersembunyi di mode kanvas layar penuh').toBe(false)
    expect(target.formVisible, 'formulir tersembunyi di mode kanvas layar penuh').toBe(false)

    // Mengaktifkan skip link → Tab berikutnya masuk ke ruang kerja, bukan
    // keluar ke halaman.
    await skip.focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => {
      const el = document.activeElement
      const main = document.getElementById('workspace-main')
      return Boolean(el && main && main.contains(el))
    })
    expect(inside, 'Tab setelah skip link masuk ke ruang kerja').toBe(true)
  })

  test('kontras toolbar kaca di atas well selebar layar tetap memadai', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    const ratio = await page.evaluate(() => {
      const toolbar = document.querySelector('#pane-preview .bg-toolbar-glass')
      const well = document.querySelector('#pane-preview')
      const label = toolbar?.querySelector('[data-probe="page-counter"]')
      if (!toolbar || !well || !label) return null

      const parse = (value: string): number[] => (value.match(/[\d.]+/g) ?? []).map(Number)
      const glass = parse(getComputedStyle(toolbar).backgroundColor)
      const back = parse(getComputedStyle(well).backgroundColor)
      const alpha = glass.length > 3 ? glass[3]! : 1
      const mix = (top: number, bottom: number) => top * alpha + bottom * (1 - alpha)
      const background = [
        mix(glass[0] ?? 255, back[0] ?? 255),
        mix(glass[1] ?? 255, back[1] ?? 255),
        mix(glass[2] ?? 255, back[2] ?? 255),
      ]
      const foreground = parse(getComputedStyle(label).color).slice(0, 3) as number[]

      const luminance = (rgb: number[]): number => {
        const channel = (value: number) => {
          const s = value / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return (
          0.2126 * channel(rgb[0] ?? 0) +
          0.7152 * channel(rgb[1] ?? 0) +
          0.0722 * channel(rgb[2] ?? 0)
        )
      }
      const l1 = luminance(foreground)
      const l2 = luminance(background)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    })

    expect(ratio, 'rasio kontras toolbar').not.toBeNull()
    expect(ratio!).toBeGreaterThanOrEqual(4.5)
  })

  test('axe: 0 violation serius di mode kanvas layar penuh (tabel 360 & 1440)', async ({
    page,
  }) => {
    for (const size of [
      { width: 360, height: 640 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size)
      await page.goto('/')
      await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10_000 })
      const later = page.getByRole('button', { name: 'Lanjut' })
      if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
        const option = page.getByRole('radio', { name: /Nanti saja/ })
        if (await option.isVisible().catch(() => false)) await option.click()
        await later.click()
      }
      // Di <1024px kertas ada di tab "Pratinjau" (mode form); di mode kanvas
      // layar penuh tab bar-nya hilang dan kertas jadi satu pane.
      if (size.width < 1024) {
        await page.getByRole('tab', { name: /Pratinjau/ }).click()
      }
      await toCanvasMode(page)
      await expect(segments(page).first()).toBeVisible()
      await page.waitForTimeout(400)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
      const violations = results.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact ?? 'unknown'),
      )
      expect(
        violations.map((v) => `${v.impact}/${v.id}`),
        `axe di ${size.width}px`,
      ).toEqual([])

      // Mode pengerjaan tersimpan di IndexedDB — kembalikan ke mode form
      // supaya iterasi berikutnya mulai dari keadaan awal.
      await page.locator('[data-probe="tampilan-menu"]').click()
      await page.locator('[data-probe="edit-mode-form"]').click()
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'form')
    }
  })
})
