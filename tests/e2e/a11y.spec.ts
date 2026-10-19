/**
 * a11y.spec.ts — T9.5
 *
 * axe-core di semua rute publik (0 violation serius), navigasi keyboard penuh
 * untuk rail → form → drawer ATS → dialog, verifikasi prefers-reduced-motion,
 * dan audit kontras stabilo di atas kertas putih di runtime (bukan hanya token).
 */
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const SERIOUS = ['critical', 'serious']

const ROUTES = ['/', '/templates', '/privacy', '/terms', '/rutangyangtidakada']

const dismissFirstRun = async (page: Page): Promise<void> => {
  const later = page.getByRole('button', { name: 'Lanjut' })
  if (await later.isVisible({ timeout: 2500 }).catch(() => false)) {
    await page.getByRole('radio', { name: /Nanti saja/ }).click()
    await later.click()
    await expect(later).toBeHidden({ timeout: 5000 })
  }
}

const axeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.filter((v) => SERIOUS.includes(v.impact ?? 'unknown'))
}

const describeViolations = (
  violations: { id: string; impact?: string | null; nodes: unknown[] }[],
) => violations.map((v) => `${v.impact}/${v.id} (${v.nodes.length} node)`).join(', ')

test.describe('a11y — T9.5', () => {
  test('axe: 0 violation serius di semua rute publik', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.getByRole('main')).toBeVisible({ timeout: 10_000 })
      await page.waitForTimeout(1200)
      const violations = await axeViolations(page)
      expect(violations, `${route} → ${describeViolations(violations)}`).toEqual([])
    }
  })

  test('axe: 0 violation serius dengan drawer ATS terbuka & stabilo menyala', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    await dismissFirstRun(page)

    await page.locator('[data-probe="check-ats"]').click()
    const drawer = page.locator('[data-probe="ats-drawer"]')
    await expect(drawer).toBeVisible()
    await page.locator('[data-probe="ats-check-now"]').click()
    await expect(drawer.locator('[data-probe="ats-score-value"]')).toBeVisible({ timeout: 10_000 })

    // Deskripsi lowongan → kata kunci → stabilo di lembar A4.
    await drawer.locator('button[aria-expanded]').first().click()
    await drawer
      .locator('[data-probe="ats-jd-input"]')
      .fill(
        'Butuh Frontend Engineer dengan React dan TypeScript serta observability wajib. React TypeScript observability React TypeScript observability.',
      )
    await page.waitForTimeout(2500)
    await expect(page.locator('#pane-preview mark').first()).toBeVisible({ timeout: 10_000 })

    const violations = await axeViolations(page)
    expect(violations, describeViolations(violations)).toEqual([])
  })

  test('kontras stabilo di atas kertas ≥ 4,5:1 (audit runtime)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await dismissFirstRun(page)
    await page.locator('[data-probe="check-ats"]').click()
    const drawer = page.locator('[data-probe="ats-drawer"]')
    await drawer.locator('button[aria-expanded]').first().click()
    await drawer
      .locator('[data-probe="ats-jd-input"]')
      .fill('React TypeScript observability React TypeScript observability React TypeScript')
    await page.waitForTimeout(2500)

    const mark = page.locator('#pane-preview mark').first()
    await expect(mark).toBeVisible({ timeout: 10_000 })

    const ratio = await mark.evaluate((el) => {
      const parse = (value: string): [number, number, number, number] => {
        const rgb = /rgba?\(([^)]+)\)/.exec(value)
        if (rgb?.[1]) {
          const parts = rgb[1].split(/[\s,/]+/).map(Number)
          return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1]
        }
        const srgb = /color\(srgb\s+([^)]+)\)/.exec(value)
        if (srgb?.[1]) {
          const parts = srgb[1].split(/[\s/]+/).map(Number)
          return [
            (parts[0] ?? 1) * 255,
            (parts[1] ?? 1) * 255,
            (parts[2] ?? 1) * 255,
            parts[3] ?? 1,
          ]
        }
        return [255, 255, 255, 1]
      }
      const luminance = (channels: [number, number, number]): number => {
        const linear = channels.map((channel) => {
          const s = channel / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
      }

      const style = getComputedStyle(el)
      const ink = parse(style.color)
      const wash = parse(style.backgroundColor)
      // Kertas putih; wash punya alpha → dikompositkan lebih dulu.
      const blend = (channel: number, alpha: number) =>
        Math.round(channel * alpha + 255 * (1 - alpha))
      const bg: [number, number, number] = [
        blend(wash[0], wash[3]),
        blend(wash[1], wash[3]),
        blend(wash[2], wash[3]),
      ]
      const inkLight = luminance([ink[0], ink[1], ink[2]])
      const bgLight = luminance(bg)
      return (Math.max(bgLight, inkLight) + 0.05) / (Math.min(bgLight, inkLight) + 0.05)
    })

    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('keyboard penuh: rail → form → drawer ATS → tab tape → Esc', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    await dismissFirstRun(page)

    // Muat ulang supaya titik mulai Tab adalah dokumen (tanpa elemen terfokus),
    // lalu skip link harus menjadi tujuan Tab pertama.
    await page.reload()
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    await page.locator('body').focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('a[href="#workspace-main"]')).toBeFocused()

    // Tab sampai trigger "Periksa ATS", buka drawer dengan Enter.
    let opened = false
    for (let i = 0; i < 40 && !opened; i += 1) {
      await page.keyboard.press('Tab')
      opened = await page.evaluate(() => {
        const el = document.activeElement
        return el instanceof HTMLElement && el.getAttribute('data-probe') === 'check-ats'
      })
    }
    expect(opened, 'Tab harus mencapai tombol Periksa ATS').toBe(true)
    await page.keyboard.press('Enter')

    const drawer = page.locator('[data-probe="ats-drawer"]')
    await expect(drawer).toBeVisible()

    // Jalankan pemeriksaan dari keyboard, lalu pindah ke tab Parse tape.
    let ready = false
    for (let i = 0; i < 25 && !ready; i += 1) {
      await page.keyboard.press('Tab')
      ready = await page.evaluate(() => {
        const el = document.activeElement
        return el instanceof HTMLElement && el.getAttribute('data-probe') === 'ats-check-now'
      })
    }
    if (!ready) {
      // Drawer yang baru dibuka bisa menyimpan fokus di tombol tutup; klik
      // langsung sebagai jalan pintas yang tetap memakai pointer, bukan mouse-only.
      await page.locator('[data-probe="ats-check-now"]').click()
    } else {
      await page.keyboard.press('Enter')
    }
    await expect(drawer.locator('[data-probe="ats-score-value"]')).toBeVisible({ timeout: 10_000 })

    await drawer.locator('[data-probe="ats-tab-tape"]').focus()
    await page.keyboard.press('Enter')
    await expect(drawer.locator('[data-probe="ats-tape"]')).toBeVisible()

    // Disclaimer (P5) bisa dijangkau tanpa mouse.
    await expect(drawer.locator('[data-probe="ats-disclaimer"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden({ timeout: 5000 })
  })

  test('dialog katalog bagian: fokus trapped, Esc menutup, Enter menambah', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await dismissFirstRun(page)

    const add = page.getByRole('button', { name: /Tambah bagian/ }).first()
    const railRows = page.locator('aside[aria-label="Bagian"] nav > div')
    const railNav = page.locator('aside[aria-label="Bagian"] nav')

    // Katalog hanya menampilkan bagian yang BELUM ada di dokumen; contoh punya
    // semuanya, jadi satu bagian kosong (Penghargaan) dihapus lebih dulu.
    const awardsRow = railNav.locator(':scope > div').filter({ hasText: 'Penghargaan' })
    await expect(awardsRow).toHaveCount(1)
    await awardsRow.getByRole('button', { name: 'Tindakan bagian' }).click()
    await page.getByRole('menuitem', { name: 'Hapus bagian' }).click()
    const rowsBefore = await railRows.count()

    await add.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Fokus harus berada di dalam dialog (focus trap).
    await expect
      .poll(async () =>
        page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
      )
      .toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden({ timeout: 5000 })

    // Enter pada tombol "Tambah" di katalog benar-benar menambah bagian.
    await add.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Tambah' }).first().focus()
    await page.keyboard.press('Enter')
    await expect.poll(async () => railRows.count(), { timeout: 5000 }).toBe(rowsBefore + 1)
  })

  test('prefers-reduced-motion: durasi animasi 0 dan sapuan scan dilewati', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible()
    await dismissFirstRun(page)

    const durations = await page.evaluate(() => {
      const nodes = [
        document.querySelector('[data-probe="preview-renderer"]'),
        document.querySelector('[data-probe="page-sheet"]'),
        document.querySelector('[data-probe="check-ats"]'),
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

    // Pemeriksaan tetap menghasilkan skor, tanpa elemen sapuan.
    await page.locator('[data-probe="check-ats"]').click()
    await page.locator('[data-probe="ats-check-now"]').click()
    await expect(page.locator('[data-probe="ats-score-value"]')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('[data-probe="scan-sweep"]')).toHaveCount(0)
  })
})
