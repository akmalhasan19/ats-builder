import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-edit.spec.ts — FASE 12 / C3
 *
 * Edit langsung di CV: klik segmen di kertas → editor in-place muncul →
 * commit menulis ke dokumen (sama seperti form) → undo satu langkah.
 * Spec ini membuktikan alur lengkap di kertas: nilai tampil, tersimpan setelah
 * reload, batal, error validasi, dan zoom yang terlalu kecil dinaikkan.
 *
 * C5.1 — dijalankan di kedua project: desktop langsung lewat popover
 * Tampilan menu; mobile (<1024px) lewat tab Pratinjau + sheet MobileMenu.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024

const segment = (page: Page, path: string) => page.locator(`#pane-preview [data-field="${path}"]`)

const editor = (page: Page) => page.locator('#pane-preview .canvas-editor')

const toCanvasMode = async (page: Page): Promise<void> => {
  if (isDesktop(page)) {
    await page.locator('[data-probe="tampilan-menu"]').click()
  } else {
    await page.getByRole('button', { name: 'Menu' }).click()
  }
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  // Popover/sheet menutupi target di kertas — tutup supaya interaksi kanvas
  // berikutnya tidak tertahan overlay (desktop: popover Tampilan; mobile:
  // sheet MobileMenu).
  //
  // FASE 13 (D1, §4) — di mode kanvas kertas langsung jadi satu pane: tab bar
  // mobile tidak dirender lagi, jadi tidak ada tab Pratinjau untuk diklik.
  await page.keyboard.press('Escape')
}

const startApp = async (page: Page): Promise<void> => {
  if (isDesktop(page)) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Lanjut' }).click()
  await expect(page.locator('#profile-fullName')).toBeVisible()
}

/**
 * Tunggu autosave dengan membaca dokumen tersimpan. C5.6 — polling IndexedDB
 * dipakai di **kedua** project: pill status TopBar ("Disimpan di perangkat")
 * bisa bertahan dari commit sebelumnya, sehingga pembacaan berikutnya masih
 * melihat nilai lama (flake nyata pada run paralel). Polling dokumen adalah
 * sinyal yang lebih kuat dan tidak melemahkan assertion.
 */
const waitForStored = async (page: Page, fragment: string): Promise<void> => {
  await expect
    .poll(async () => JSON.stringify((await readStoredDoc(page)) ?? {}).toLowerCase(), {
      timeout: 10_000,
      intervals: [250, 500, 1000],
    })
    .toContain(fragment.toLowerCase())
}

/** Dokumen tersimpan di IndexedDB — sumber kebenaran yang sama dengan form. */
const readStoredDoc = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const request = indexedDB.open('keyval-store')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('keyval', 'readonly')
          const get = tx.objectStore('keyval').get('ats:doc:v1')
          get.onsuccess = () => {
            db.close()
            resolve(get.result as Record<string, unknown> | undefined)
          }
          get.onerror = () => {
            db.close()
            reject(get.error)
          }
        }
      }),
  )

const profileOf = (doc: Record<string, unknown> | undefined) => {
  const sections = (doc?.sections ?? []) as { kind: string; data: unknown }[]
  return sections.find((section) => section.kind === 'profile')?.data
}

test.describe('edit langsung di CV (C3)', () => {
  test('klik segmen → editor in-place → Enter commit: nilai tampil & tersimpan setelah reload', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)

    await segment(page, 'profile.fullName').click()
    const control = editor(page)
    await expect(control).toBeVisible()
    await expect(control).toBeFocused()
    await expect(control).toHaveValue('Alex Morgan')

    await control.fill('Budi Santoso')
    await control.press('Enter')

    await expect(segment(page, 'profile.fullName')).toHaveText('Budi Santoso')
    await waitForStored(page, 'Budi Santoso')

    await page.reload()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
    // FASE 13 (D1) — di mode kanvas kertas tetap jadi satu pane setelah reload:
    // tidak ada tab yang perlu dibuka, panel formulir tidak dirender.
    await expect(page.locator('#pane-form')).toBeHidden()
    await expect(segment(page, 'profile.fullName')).toHaveText('Budi Santoso')
  })

  test('Escape membatalkan edit: nilai lama tetap', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await segment(page, 'profile.fullName').click()
    const control = editor(page)
    await control.fill('Budi Santoso')
    await control.press('Escape')

    await expect(editor(page)).toHaveCount(0)
    await expect(segment(page, 'profile.fullName')).toHaveText('Alex Morgan')
  })

  test('commit tidak valid: editor tetap terbuka dengan pesan error', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await segment(page, 'profile.email').click()
    const control = editor(page)
    await control.fill('bukan-email')
    await control.press('Enter')

    await expect(control).toBeVisible()
    await expect(control).toHaveAttribute('aria-invalid', 'true')
    const alert = page.locator('#pane-preview .canvas-editor-shell [role="alert"]')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Email belum benar')

    // Batal → nilai lama tetap utuh (commit yang gagal tidak menulis apa pun).
    await control.press('Escape')
    await expect(segment(page, 'profile.email')).toHaveText('alex.morgan@mail.com')
  })

  test('field wajib dikosongkan: nilai kosong ditulis & guide tampil lagi', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await segment(page, 'profile.fullName').click()
    const control = editor(page)
    await control.fill('')
    await control.press('Enter')

    // Nilai kosong tetap ditulis (validasi zod mengizinkan) dan slotnya
    // menampilkan guide lagi — bukan revert + toast.
    await expect(editor(page)).toHaveCount(0)
    await expect(segment(page, 'profile.fullName')).toHaveAttribute('data-canvas-guide', 'true')
    await expect(segment(page, 'profile.fullName')).toHaveText('Nama lengkap')
  })

  test('undo membatalkan satu commit kanvas', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await segment(page, 'profile.fullName').click()
    const control = editor(page)
    await control.fill('Budi Santoso')
    await control.press('Enter')
    await expect(segment(page, 'profile.fullName')).toHaveText('Budi Santoso')

    // Fokus sudah kembali ke tombol pemicu, jadi shortcut undo tingkat
    // dokumen yang berlaku (bukan undo bawaan field).
    await expect(segment(page, 'profile.fullName')).toBeFocused()
    await page.keyboard.press('Control+z')
    await expect(segment(page, 'profile.fullName')).toHaveText('Alex Morgan')
  })

  test('zoom di bawah 60% dinaikkan ke 75% saat sesi dibuka', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)
    await page.keyboard.press('Escape')

    // Menu Tampilan di toolbar pratinjau tersedia di kedua panel mode:
    // popover Radix berjangkar pada toolbar, cukup lebar di Pixel 7.
    // `exact` wajib: di mode kanvas ada preset 150% yang teksnya memuat "50%".
    await page.locator('[data-probe="tampilan-menu"]').click()
    await page.getByRole('radio', { name: '50%', exact: true }).click()
    await page.keyboard.press('Escape')

    await segment(page, 'profile.fullName').click()
    await expect(editor(page)).toBeVisible()
    // Toast "zoom dinaikkan" hanya di desktop: di mobile toast duduk tepat di
    // atas field yang sedang diedit (addendum FASE 13) — nilai zoom di
    // toolbar yang memberi tahu.
    if (isDesktop(page)) {
      await expect(page.getByText('Zoom dinaikkan ke 75%')).toBeVisible()
    } else {
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    }

    // Membuka menu Tampilan memindahkan fokus → editor blur → sesi ditutup.
    // Desktop: guard D7 tidak mengembalikan zoom, jadi 75% tetap aktif.
    // Mobile: addendum FASE 13 mengembalikan zoom ringkasan saat sesi
    // ditutup, jadi preset 50% yang aktif lagi.
    await page.locator('[data-probe="tampilan-menu"]').click()
    const expected = isDesktop(page) ? '75%' : '50%'
    await expect(page.getByRole('radio', { name: expected, exact: true })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('dokumen hasil edit kanvas identik dengan hasil edit form', async ({ page }) => {
    await startApp(page)

    // (1) lewat form terpandu.
    await page.locator('#profile-fullName').fill('Budi Santoso')
    await page.locator('#profile-email').fill('budi@mail.com')
    await waitForStored(page, 'budi@mail.com')
    const viaForm = profileOf(await readStoredDoc(page))

    // (2) lewat kanvas, dengan nilai yang sama.
    await toCanvasMode(page)
    await segment(page, 'profile.fullName').click()
    await editor(page).fill('Budi Santoso')
    await editor(page).press('Enter')
    await segment(page, 'profile.email').click()
    await editor(page).fill('budi@mail.com')
    await editor(page).press('Enter')
    await waitForStored(page, 'budi@mail.com')
    const viaCanvas = profileOf(await readStoredDoc(page))

    expect(viaCanvas).toEqual(viaForm)
  })

  test('axe: 0 violation serius saat editor kanvas terbuka', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await segment(page, 'profile.fullName').click()
    await expect(editor(page)).toBeVisible()
    // Reflow kertas pasca zoom dinaikkan (D7) berjalan semalam-malam; beri
    // waktu settle supaya pengukuran kontras axe tidak menembak layout mutakhir.
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
