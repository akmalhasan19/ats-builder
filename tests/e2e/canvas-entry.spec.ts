import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * canvas-entry.spec.ts — FASE 12 / C4
 *
 * Entri dibuat dan diisi langsung di atas kertas: ghost row "+ Tambahkan entri"
 * → kepala entri (role/company) → editor tanggal → bullet. Spec ini menutup
 * Gate C4: CV bisa disusun dari nol tanpa menyentuh form, dan isi yang diketik
 * di kanvas benar-benar sampai ke berkas PDF (isi sama, pemandu & ghost tidak).
 *
 * C5.1 — dijalankan di kedua project: desktop memakai kertas penuh; mobile
 * (<1024px) membuka kertas lewat tab Pratinjau, mode kanvas dari sheet
 * MobileMenu, dan editor tanggal tampil sebagai Sheet bawah (§5.3).
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 1440) >= 1024

const segment = (page: Page, path: string) => page.locator(`#pane-preview [data-field="${path}"]`)

/** Segmen milik ENTRI TERAKHIR bagian pengalaman — entri yang baru dibuat ghost row. */
const lastExperienceSegment = (page: Page, suffix: string) =>
  page.locator(`#pane-preview [data-field^="entries.experience"][data-field$="${suffix}"]`).last()

const editor = (page: Page) => page.locator('#pane-preview .canvas-editor')

const ghost = (page: Page, kind: 'entry' | 'bullet' | 'section') =>
  page.locator(`#pane-preview [data-canvas-ghost="${kind}"]`).first()

const datesPopover = (page: Page) => page.locator('[data-probe="canvas-dates"]')

const toCanvasMode = async (page: Page): Promise<void> => {
  if (isDesktop(page)) {
    await page.locator('[data-probe="tampilan-menu"]').click()
  } else {
    await page.getByRole('button', { name: 'Menu' }).click()
  }
  await page.locator('[data-probe="edit-mode-canvas"]').click()
  await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
  // Popover/sheet menutup soal target di kertas — keduanya ditutup supaya
  // interaksi kanvas berikutnya tidak tertutup overlay (desktop: popover
  // Tampilan; mobile: sheet MobileMenu, lalu pindah ke tab Pratinjau).
  // FASE 13 (D1, §4) — di mode kanvas kertas langsung jadi satu pane: tab bar
  // mobile tidak dirender lagi, jadi tidak ada tab Pratinjau untuk diklik.
  await page.keyboard.press('Escape')
}

/** Viewport kerja + kartu first-run; `empty` = dokumen bersih tanpa contoh. */
const startApp = async (page: Page, mode: 'sample' | 'empty' = 'sample'): Promise<void> => {
  if (isDesktop(page)) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('#pane-form')).toBeVisible({ timeout: 10_000 })
  if (mode === 'empty') {
    await page.getByRole('radio', { name: 'Mulai dari kosong' }).click()
  }
  await page.getByRole('button', { name: 'Lanjut' }).click()
  if (!isDesktop(page)) {
    await page.getByRole('tab', { name: /Pratinjau/ }).click()
  }
  await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
    timeout: 10_000,
  })
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

/**
 * Tunggu autosave: desktop = pill status TopBar; mobile (C5.1) = pill tidak
 * ada di <lg, jadi tunggu dokumen tersimpan memuat *fragment* — bukti commit
 * terakhir benar-benar sudah ditulis ke IndexedDB (mark waktu kalah cepat
 * karena banyak commit beruntun).
 */
const waitForStored = async (page: Page, fragment: string): Promise<void> => {
  if (isDesktop(page)) {
    await expect(page.getByRole('status', { name: 'Status penyimpanan' })).toHaveText(
      'Disimpan di perangkat',
      { timeout: 8000 },
    )
    return
  }
  await expect
    .poll(async () => JSON.stringify((await readStoredDoc(page)) ?? {}).toLowerCase(), {
      timeout: 10_000,
      intervals: [250, 500, 1000],
    })
    .toContain(fragment.toLowerCase())
}

/**
 * Mengetik di sesi yang SUDAH terbuka — ghost row membuka sesi field pertamanya
 * sendiri (D10), jadi tidak ada segmen yang perlu diklik lagi. Ringkasan
 * (textarea multi-baris) commit dengan Ctrl+Enter (D3), bullet dengan Enter (OQ6).
 */
const typeInOpenEditor = async (
  page: Page,
  value: string,
  commit: 'enter' | 'ctrlEnter' = 'enter',
): Promise<void> => {
  const control = editor(page)
  await expect(control).toBeVisible()
  await control.fill(value)
  await control.press(commit === 'ctrlEnter' ? 'Control+Enter' : 'Enter')
  await expect(editor(page)).toHaveCount(0)
}

/** Klik sebuah segmen lalu ketik dan commit. */
const fillSegment = async (
  page: Page,
  locator: ReturnType<typeof segment>,
  value: string,
  commit: 'enter' | 'ctrlEnter' = 'enter',
) => {
  await locator.click()
  await typeInOpenEditor(page, value, commit)
}

/** Isi tanggal lewat editor tanggal: bulan mulai, bulan selesai, lalu Simpan. */
const fillDates = async (
  page: Page,
  target: ReturnType<typeof segment>,
  start: string,
  end: string,
): Promise<void> => {
  await target.click()
  const popover = datesPopover(page)
  await expect(popover).toBeVisible()
  const months = popover.locator('input[type="month"]')
  await expect(months.first()).toBeVisible()
  await months.nth(0).fill(start)
  if ((await months.count()) > 1) await months.nth(1).fill(end)
  await popover.getByRole('button', { name: 'Simpan' }).click()
  await expect(popover).toHaveCount(0)
}

/** Teks PDF yang bisa dibandingkan: huruf & angka saja (menghilangkan spasi, tracking, wrap). */
const squash = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

async function downloadPdf(page: Page): Promise<Buffer> {
  const button = page.locator('[data-probe="download-pdf"]:visible').last()
  await expect(button).toBeEnabled()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    button.click(),
  ])
  const file = await download.path()
  if (!file) throw new Error('berkas hasil unduh tidak tersedia')
  const fs = await import('node:fs')
  return fs.readFileSync(file)
}

async function pdfSquashedText(bytes: Buffer): Promise<string> {
  const task = getDocument({ data: new Uint8Array(bytes), verbosity: 0 })
  const doc = await task.promise
  const chunks: string[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items as { str?: string }[]
    chunks.push(items.map((item) => item.str ?? '').join(' '))
    await page.cleanup()
  }
  await task.destroy()
  return squash(chunks.join(' '))
}

test.describe('edit langsung di CV — entri (C4)', () => {
  test('CV dari nol disusun sepenuhnya di kanvas, tersimpan, dan tampil kembali setelah reload', async ({
    page,
  }) => {
    await startApp(page, 'empty')
    await toCanvasMode(page)

    // 1. Header — pemandu di kertas jadi target klik (C3/C4).
    await fillSegment(page, segment(page, 'profile.fullName'), 'Budi Santoso')
    await fillSegment(page, segment(page, 'profile.headline'), 'Frontend Engineer')
    await fillSegment(page, segment(page, 'profile.email'), 'budi@mail.com')
    await fillSegment(page, segment(page, 'profile.phone'), '+62 812 3456 7890')

    // 2. Ringkasan — textarea, commit Ctrl+Enter (D3).
    await fillSegment(
      page,
      segment(page, 'summary.text'),
      'Membangun antarmuka web yang cepat dan mudah dibaca mesin.',
      'ctrlEnter',
    )

    // 3. Pengalaman — ghost row membuat entrinya dan membuka sesi field pertama (D10).
    await ghost(page, 'entry').click()
    await typeInOpenEditor(page, 'Frontend Engineer')
    await fillSegment(page, lastExperienceSegment(page, '.company'), 'Kirana Digital')
    await fillDates(page, lastExperienceSegment(page, '.dates'), '2021-03', '2024-05')

    // Bullet: ghost row menambah slot kosong, editor sudah terbuka padanya.
    await ghost(page, 'bullet').click()
    await typeInOpenEditor(page, 'Membangun design system yang dipakai 6 tim produk.')

    // Kumpulan commit hingga bullet terakhir harus sudah tertulis sebelum reload.
    await waitForStored(page, 'design system yang dipakai 6 tim produk.')

    // Isi muncul di kertas, pemandu slot itu hilang.
    await expect(segment(page, 'profile.fullName')).toHaveText('Budi Santoso')
    await expect(lastExperienceSegment(page, '.company')).toHaveText('Kirana Digital')
    await expect(lastExperienceSegment(page, '.dates')).toContainText('Mar 2021')
    await expect(lastExperienceSegment(page, '.bullets[0]')).toContainText('design system')

    await page.reload()
    await expect(page.locator('[data-edit-mode]')).toHaveAttribute('data-edit-mode', 'canvas')
    // FASE 13 (D1) — di mode kanvas kertas tetap jadi satu pane setelah reload:
    // tidak ada tab yang perlu dibuka, panel formulir tidak dirender.
    await expect(page.locator('#pane-form')).toBeHidden()
    await expect(segment(page, 'profile.fullName')).toHaveText('Budi Santoso')
    await expect(lastExperienceSegment(page, '.bullets[0]')).toContainText('design system')
  })

  test('isi entri dari kanvas ikut terunduh ke PDF; ghost row & pemandu tidak', async ({
    page,
  }) => {
    await startApp(page)
    await toCanvasMode(page)

    await ghost(page, 'entry').click()
    await typeInOpenEditor(page, 'Platform Engineer')
    await fillSegment(page, lastExperienceSegment(page, '.company'), 'Nimbus Works')
    await fillDates(page, lastExperienceSegment(page, '.dates'), '2019-01', '2020-02')
    await fillSegment(
      page,
      lastExperienceSegment(page, '.bullets[0]'),
      'Memangkas biaya infrastruktur 30% lewat penjadwalan kerja batch.',
    )
    await waitForStored(page, 'biaya infrastruktur 30%')

    const bytes = await downloadPdf(page)
    const text = await pdfSquashedText(bytes)

    expect(text).toContain(squash('Platform Engineer'))
    expect(text).toContain(squash('Nimbus Works'))
    expect(text).toContain(squash('Memangkas biaya infrastruktur 30%'))
    expect(text).toContain(squash('Jan 2019'))
    expect(text).toContain(squash('Feb 2020'))

    // Affordance kanvas tidak pernah masuk berkas (D5/D12).
    expect(text).not.toContain(squash('Tambahkan entri'))
    expect(text).not.toContain(squash('Tambahkan bullet'))
    expect(text).not.toContain(squash('Tambahkan bagian'))
    expect(text).not.toContain(squash('Satu bullet: aksi + dampak'))
  })

  test('mode form: nol ghost row dan nol segmen interaktif di kertas', async ({ page }) => {
    await startApp(page)
    await expect(page.locator('#pane-preview [data-canvas-ghost]')).toHaveCount(0)
    await expect(page.locator('#pane-preview [data-field]')).toHaveCount(0)
  })

  test('axe: 0 violation serius saat editor tanggal terbuka', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await page
      .locator('#pane-preview [data-field^="entries.experience"][data-field$=".dates"]')
      .first()
      .click()
    await expect(datesPopover(page)).toBeVisible()
    // Beri waktu reflow (zoom D7) settle sebelum pengukuran axe.
    await page.waitForTimeout(400)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    const violations = results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? 'unknown'),
    )
    expect(violations.map((violation) => `${violation.impact}/${violation.id}`)).toEqual([])
  })

  test('ghost "+ Tambahkan bagian" membuka dialog katalog rail', async ({ page }) => {
    await startApp(page)
    await toCanvasMode(page)

    await ghost(page, 'section').click()
    await expect(page.getByRole('heading', { name: 'Tambah bagian CV' })).toBeVisible()
  })
})
