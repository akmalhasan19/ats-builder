import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('Unduh PDF uji menghasilkan berkas %PDF lewat chunk lazy', async ({ page }) => {
  const chunkRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('spikePdf')) chunkRequests.push(request.url())
  })

  await page.goto('/dev/pdf')
  const downloadButton = page.getByRole('button', { name: /Unduh PDF uji/ })
  await expect(downloadButton).toBeVisible()
  expect(chunkRequests, 'renderer PDF tidak boleh ikut bundle awal').toHaveLength(0)

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    downloadButton.click(),
  ])

  expect(chunkRequests.length, 'chunk PDF baru dimuat saat tombol diklik').toBeGreaterThan(0)
  expect(download.suggestedFilename()).toBe('spike-a4.pdf')

  const file = await download.path()
  expect(file, 'berkas hasil unduh tersedia').not.toBeNull()
  const bytes = readFileSync(file!)
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
  expect(bytes.length).toBeGreaterThan(4000)

  await expect(page.locator('iframe')).toBeVisible()
})
