/**
 * download-pdf.spec.ts — Gate Fase 5
 *
 * Alur inti produk: dari workspace yang sudah terisi, tombol `Download PDF`
 * menghasilkan berkas PDF berbasis teks. Test ini memverifikasi berkas yang
 * benar-benar terunduh browser: magic bytes `%PDF`, nama berkas, halaman PDF
 * sama dengan `pageCount` pratinjau, dan toast sukses muncul.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { expect, test, type Download, type Page } from '@playwright/test'

const ARTIFACT_DIR = path.resolve('artifacts', 'fase5')

/** Membaca `HAL 1 / 2` dari toolbar pratinjau → jumlah halaman yang dilihat pengguna. */
async function previewPageCount(page: Page): Promise<number> {
  const label = page.locator('[data-probe="page-counter"]')
  await expect(label).toBeVisible({ timeout: 10_000 })
  const text = (await label.innerText()).replace(/\s+/g, ' ')
  const match = /(\d+)\s*\/\s*(\d+)/.exec(text)
  if (!match) throw new Error(`label halaman tidak terbaca: ${text}`)
  return Number(match[2])
}

/** pdf-lib menulis object stream, jadi jumlah halaman dibaca dari dokumennya. */
async function pdfPageCount(bytes: Buffer): Promise<number> {
  return (await PDFDocument.load(new Uint8Array(bytes))).getPageCount()
}

async function saveDownload(download: Download, name: string): Promise<Buffer> {
  const file = await download.path()
  if (!file) throw new Error('berkas hasil unduh tidak tersedia')
  const bytes = readFileSync(file)
  mkdirSync(ARTIFACT_DIR, { recursive: true })
  writeFileSync(path.join(ARTIFACT_DIR, name), bytes)
  return bytes
}

test.describe('download-pdf — Gate Fase 5', () => {
  test('klik Download PDF → berkas %PDF valid, halaman sama dengan pratinjau', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // T5.4 — engine PDF (pdf-lib + fontkit) tidak boleh ikut bundle awal.
    const engineRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('renderResumePdf')) engineRequests.push(request.url())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
      timeout: 10_000,
    })
    expect(engineRequests, 'chunk PDF tidak dimuat sebelum tombol diklik').toHaveLength(0)

    // FirstRunCard: dokumen contoh sudah terisi, jadi cukup tutup kartunya.
    const lanjut = page.getByRole('button', { name: 'Lanjut' })
    if (await lanjut.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await lanjut.click()
    }

    const expectedPages = await previewPageCount(page)

    const downloadButton = page.locator('[data-probe="download-pdf"]:visible').last()
    await expect(downloadButton).toBeEnabled()
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      downloadButton.click(),
    ])

    expect(download.suggestedFilename()).toMatch(
      /^[a-z0-9-]+-(ledger|technician|classic-ats|executive|minimal)\.pdf$/,
    )
    const bytes = await saveDownload(download, 'e2e-download.pdf')

    expect(engineRequests.length, 'chunk PDF baru dimuat saat tombol diklik').toBeGreaterThan(0)

    expect(bytes.length).toBeGreaterThan(4_000)
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(await pdfPageCount(bytes), 'halaman PDF = pageCount pratinjau').toBe(expectedPages)

    await expect(page.getByText('PDF terunduh')).toBeVisible({ timeout: 10_000 })

    const relevantErrors = consoleErrors.filter(
      (error) => !error.includes('favicon') && !error.includes('ResizeObserver'),
    )
    expect(relevantErrors, `Error konsol: ${relevantErrors.join(', ')}`).toHaveLength(0)
  })

  test('nama berkas mengikuti judul di top bar (ketik lalu langsung unduh)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
      timeout: 10_000,
    })

    const lanjut = page.getByRole('button', { name: 'Lanjut' })
    if (await lanjut.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await lanjut.click()
    }

    // Alur nyata: judul diketik di top bar lalu tombol Unduh diklik langsung
    // (tanpa Enter). Judul harus tersimpan saat input kehilangan fokus, dan
    // nama berkas harus mengikuti judul itu — bukan nama lengkap profil.
    await page.getByRole('button', { name: /Ubah judul CV/ }).click()
    await page.getByLabel('Judul dokumen').fill('CV Produk Unggulan')

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.locator('[data-probe="download-pdf"]:visible').last().click(),
    ])

    expect(download.suggestedFilename()).toMatch(/^cv-produk-unggulan-[a-z0-9-]+\.pdf$/)
    expect(download.suggestedFilename()).not.toContain('alex-morgan')

    // Nama berkas ikut ditampilkan di toast supaya hubungannya dengan judul terlihat.
    await expect(page.getByText('PDF terunduh')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(download.suggestedFilename())).toBeVisible({ timeout: 10_000 })
  })
})
