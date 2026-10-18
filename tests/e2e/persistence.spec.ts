import { expect, test, type Page } from '@playwright/test'
import { id } from '../../src/dictionaries/id'

async function overwriteDocWithGarbage(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open('keyval-store')
        openRequest.onerror = () => reject(openRequest.error)
        openRequest.onsuccess = () => {
          const db = openRequest.result
          const tx = db.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put('isi-berkas-rusak-total', 'ats:doc:v1')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        }
      }),
  )
}

test('isi form → refresh browser → data utuh', async ({ page }) => {
  await page.goto('/dev/persist')

  const nameInput = page.getByLabel(id['persist.dev.fullName'])
  const titleInput = page.getByLabel(id['persist.dev.docTitle'])
  const status = page.getByRole('status')

  await expect(nameInput).toHaveValue('Alex Morgan')

  await nameInput.fill('Budi Santoso')
  await titleInput.fill('CV Uji E2E')
  await expect(status).toHaveText(id['status.savedLocal'], { timeout: 5000 })

  await page.reload()

  await expect(nameInput).toHaveValue('Budi Santoso')
  await expect(titleInput).toHaveValue('CV Uji E2E')
})

async function waitForFirstBootWrite(page: Page): Promise<void> {
  // Boot pertama menulis dokumen contoh ke IndexedDB; kalau ditimpa sebelum
  // selesai, overwrite test justru tertimpa balik dan cabang korup tidak jalan.
  await page.waitForFunction(
    async () =>
      await new Promise<boolean>((resolve) => {
        const request = indexedDB.open('keyval-store')
        request.onerror = () => resolve(false)
        request.onsuccess = () => {
          const tx = request.result.transaction('keyval', 'readonly')
          const get = tx.objectStore('keyval').get('ats:doc:v1')
          get.onsuccess = () => resolve(typeof get.result === 'object' && get.result !== null)
          get.onerror = () => resolve(false)
        }
      }),
    undefined,
    { polling: 100, timeout: 10000 },
  )
}

test('dokumen korup → pulih dengan dokumen contoh, tanpa layar putih', async ({ page }) => {
  await page.goto('/dev/persist')
  await waitForFirstBootWrite(page)
  await overwriteDocWithGarbage(page)

  await page.reload()

  await expect(page.getByLabel(id['persist.dev.fullName'])).toHaveValue('Alex Morgan')
  await expect(page.getByText(id['persist.corrupt.restored'])).toBeVisible({ timeout: 8000 })
  await expect(page.getByRole('status')).toBeVisible()
})
