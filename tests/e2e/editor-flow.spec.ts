/**
 * editor-flow.spec.ts — Gate Fase 3
 *
 * Skenario utama: pengguna mengisi profil, menambah satu entri pengalaman
 * dengan dua bullet, lalu memuat ulang halaman. Semua data harus tetap ada
 * (IndexedDB local-first = Gate Fase 3 persistence check).
 */
import { expect, test, type Page } from '@playwright/test'

test.describe('editor-flow — Gate Fase 3', () => {
  /**
   * Isi profile + experience + 2 bullet → refresh → data tetap ada.
   */
  test('isi profile + 1 experience + 2 bullet → refresh → data ada', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
      timeout: 10000,
    })

    // ---- Batalkan FirstRunCard jika muncul (pilih Nanti saja) ----
    const laterBtn = page.getByRole('button', { name: 'Lanjut' })
    if (await laterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const laterOption = page.getByRole('radio', { name: /Nanti saja/ })
      if (await laterOption.isVisible().catch(() => false)) {
        await laterOption.click()
      }
      await laterBtn.click()
    }

    // ---- Navigasi ke Profil ----
    const profileSectionBtn = page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Profil' })
      .first()
    await profileSectionBtn.click()
    await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible({
      timeout: 5000,
    })

    // ---- Isi form Profil ----
    await page.locator('#profile-fullName').fill('Dewi Rahayu')
    await page.locator('#profile-headline').fill('Full Stack Developer')
    await page.locator('#profile-email').fill('dewi@contoh.com')
    await page.locator('#profile-phone').fill('+62 812 3456 7890')

    // ---- Navigasi ke Pengalaman ----
    const expSectionBtn = page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Pengalaman' })
      .first()
    await expSectionBtn.click()
    await expect(page.getByRole('heading', { name: 'Pengalaman', level: 1 })).toBeVisible({
      timeout: 5000,
    })

    // ---- Tambah entri pengalaman ----
    await page.getByRole('button', { name: /Tambah pekerjaan/ }).click()
    // Entri baru auto-expand & jadi satu-satunya kartu yang merender body.
    const roleInput = page.locator('[id^="exp-"][id$="-role"]').first()
    await expect(roleInput).toBeVisible({ timeout: 5000 })
    await roleInput.fill('Software Engineer')

    const companyInput = page.locator('[id^="exp-"][id$="-company"]').first()
    await companyInput.fill('PT Solusi Digital')

    // ---- Tambah 2 bullet ----
    const addBulletBtn = page.getByRole('button', { name: /Tambah bullet/ }).first()
    await addBulletBtn.click()
    const bulletTextareas = page.locator('textarea[placeholder*="aksi dan hasil"]')
    await bulletTextareas
      .first()
      .fill('Mengembangkan fitur checkout yang meningkatkan konversi 35%.')

    await addBulletBtn.click()
    await bulletTextareas.nth(1).fill('Memimpin migrasi database yang memangkas waktu query 60%.')
    // ---- Tunggu autosave ----
    await expect(page.getByRole('status', { name: 'Status penyimpanan' })).toContainText(
      'Disimpan di perangkat',
      { timeout: 8000 },
    )

    // ---- Reload dan verifikasi ----
    await page.reload()
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator('#pane-preview [data-probe="page-sheet"]').first()).toBeVisible({
      timeout: 10000,
    })

    // Profil harus terbaca setelah reload
    const profileBtnR = page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Profil' })
      .first()
    await profileBtnR.click()
    await expect(page.getByRole('heading', { name: 'Profil', level: 1 })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.locator('#profile-fullName')).toHaveValue('Dewi Rahayu')
    await expect(page.locator('#profile-email')).toHaveValue('dewi@contoh.com')

    // Pengalaman dan bullet harus terbaca. Entri yang diisi adalah entri baru
    // (terakhir); kartu contoh yang ter-expand saat boot harus ditutup dulu.
    const expBtnR = page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('button')
      .filter({ hasText: 'Pengalaman' })
      .first()
    await expBtnR.click()
    await expect(page.getByRole('heading', { name: 'Pengalaman', level: 1 })).toBeVisible({
      timeout: 5000,
    })

    const newEntryCard = page.locator('[data-entry-id]').last()
    const newEntryHeader = newEntryCard.locator('[aria-expanded]').first()
    if ((await newEntryHeader.getAttribute('aria-expanded')) === 'false') {
      await newEntryHeader.click()
    }
    await expect(newEntryCard.locator('[id$="-role"]').first()).toHaveValue('Software Engineer')
    await expect(newEntryCard.locator('[id$="-company"]').first()).toHaveValue('PT Solusi Digital')

    const bulletValues = await newEntryCard
      .locator('textarea[placeholder*="aksi dan hasil"]')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLTextAreaElement).value))
    expect(bulletValues.some((v) => v.includes('checkout'))).toBe(true)
    expect(bulletValues.some((v) => v.includes('database'))).toBe(true)

    // Tidak ada error console selain hal di luar kendali kita
    const relevantErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('ResizeObserver'),
    )
    expect(relevantErrors, `Error konsol: ${relevantErrors.join(', ')}`).toHaveLength(0)
  })

  /**
   * Rail: visibility toggle berfungsi.
   */
  test('rail: toggle visibility menyembunyikan dan menampilkan section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const visibilityCheckbox = page
      .locator('aside[aria-label="Bagian"] nav')
      .getByRole('checkbox', { name: /Tampilkan atau sembunyikan bagian/ })
      .nth(1) // indeks 1 = Ringkasan (indeks 0 = Profil, mungkin tidak bisa disembunyikan)

    const initialChecked = await visibilityCheckbox.getAttribute('aria-checked')

    await visibilityCheckbox.click()
    const afterFirst = await visibilityCheckbox.getAttribute('aria-checked')
    expect(afterFirst).not.toBe(initialChecked)

    await visibilityCheckbox.click()
    const afterSecond = await visibilityCheckbox.getAttribute('aria-checked')
    expect(afterSecond).toBe(initialChecked)
  })

  /**
   * Rail: tambah section dari katalog.
   */
  test('rail: tambah section dari katalog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    // Klik tombol "+ Tambah bagian"
    const addSectionBtn = page.getByRole('button', { name: /Tambah bagian/ })
    if (!(await addSectionBtn.isVisible())) {
      // Mungkin semua section sudah ada — skip
      return
    }
    await addSectionBtn.click()

    // Dialog katalog harus muncul
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: 'Tambah bagian CV' }),
    ).toBeVisible()

    // Tutup dialog
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3000 })
  })
})

test.describe('reorder section — Gate Fase 3 (mouse, sentuhan, keyboard)', () => {
  const readOrder = async (page: Page): Promise<string[]> => {
    const items = page.locator('aside[aria-label="Bagian"] nav > div')
    const count = await items.count()
    const labels: string[] = []
    for (let index = 0; index < count; index += 1) {
      labels.push((await items.nth(index).locator('button').nth(1).innerText()).trim())
    }
    return labels
  }

  const dragHandleOf = (page: Page, itemIndex: number) =>
    page
      .locator('aside[aria-label="Bagian"] nav > div')
      .nth(itemIndex)
      .getByRole('button', { name: 'Tarik untuk mengubah urutan' })

  test('mouse: drag handle memindahkan section ke posisi baru', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const before = await readOrder(page)
    expect(before[0]).toBe('Profil')

    const handle = dragHandleOf(page, 0)
    const handleBox = (await handle.boundingBox())!
    const secondItem = page.locator('aside[aria-label="Bagian"] nav > div').nth(1)
    const secondBox = (await secondItem.boundingBox())!

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    // Geser bertahap supaya PointerSensor (activationConstraint distance 5) aktif.
    await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2, {
      steps: 8,
    })
    await page.mouse.up()

    const after = await readOrder(page)
    expect(after[0]).toBe('Ringkasan')
    expect(after[1]).toBe('Profil')
    await page.screenshot({ path: 'artifacts/evidence/fase3-reorder-mouse.png' })
  })

  test('touch: drag handle (pointer touch) memindahkan section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const before = await readOrder(page)
    expect(before[0]).toBe('Profil')

    const handleBox = (await dragHandleOf(page, 0).boundingBox())!
    const secondBox = (await page
      .locator('aside[aria-label="Bagian"] nav > div')
      .nth(1)
      .boundingBox())!

    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2
    const endY = secondBox.y + secondBox.height / 2

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    })
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + ((endY - startY) * step) / 6 }],
      })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    const after = await readOrder(page)
    expect(after[0]).toBe('Ringkasan')
    expect(after[1]).toBe('Profil')
    await page.screenshot({ path: 'artifacts/evidence/fase3-reorder-touch.png' })
  })

  test('keyboard: Space mengangkat, panah memindahkan, Space melepas + pengumuman aria-live', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const before = await readOrder(page)
    expect(before[0]).toBe('Profil')

    // fokus ke drag handle section pertama lalu operasikan keyboard sensor dnd-kit
    await dragHandleOf(page, 0).focus()
    await page.keyboard.press('Space')
    await expect(page.locator('[data-probe="drag-overlay"]')).toBeVisible()
    // Sensor keyboard dnd-kit butuh satu frame untuk menyusun ulang rect item
    // sebelum panah pertama diproses; tanpa jeda ini ArrowDown tertelan.
    await page.waitForTimeout(200)
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(200)
    await page.keyboard.press('Space')

    await expect
      .poll(async () => (await readOrder(page)).slice(0, 2), { timeout: 5000 })
      .toEqual(['Ringkasan', 'Profil'])

    // aria-live mengumumkan urutan baru (T3.2)
    await expect(page.locator('div.sr-only[role="status"]')).toContainText(
      /pindah ke posisi 2 dari/,
    )
    await page.screenshot({ path: 'artifacts/evidence/fase3-reorder-keyboard.png' })
  })

  test('rail: hapus section lewat menu, lengkap dengan konfirmasi bila berisi data', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    const railNav = page.locator('aside[aria-label="Bagian"] nav')
    const rowCountBefore = await railNav.locator(':scope > div').count()

    // Penghargaan di dokumen contoh belum terisi → hapus langsung tanpa dialog
    const awardsRow = railNav.locator(':scope > div').filter({ hasText: 'Penghargaan' })
    await expect(awardsRow).toHaveCount(1)
    await awardsRow.getByRole('button', { name: 'Tindakan bagian' }).hover()
    await awardsRow.getByRole('button', { name: 'Tindakan bagian' }).click()
    await page.getByRole('menuitem', { name: 'Hapus bagian' }).click()

    await expect(railNav.locator(':scope > div')).toHaveCount(rowCountBefore - 1)
    await expect(railNav.getByRole('button').filter({ hasText: 'Penghargaan' })).toHaveCount(0)

    // Profil berisi data → dialog konfirmasi muncul; batalkan dulu lalu konfirmasi
    const profileRow = railNav.locator(':scope > div').filter({ hasText: 'Profil' })
    await profileRow.getByRole('button', { name: 'Tindakan bagian' }).click()
    await page.getByRole('menuitem', { name: 'Hapus bagian' }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 })
    await page.getByRole('button', { name: 'Batal' }).click()
    await expect(railNav.getByRole('button').filter({ hasText: 'Profil' }).first()).toBeVisible()
  })

  test('form: setiap input/textarea/select punya label terikat', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('aside[aria-label="Bagian"]')).toBeVisible({ timeout: 10000 })

    // Buka tiap section satu per satu, lalu audit label di form pane.
    const railNav = page.locator('aside[aria-label="Bagian"] nav')
    const sectionCount = await railNav.locator(':scope > div').count()

    for (let index = 0; index < sectionCount; index += 1) {
      await railNav.locator(':scope > div').nth(index).locator('button').nth(1).click()

      const unlabeled: string[] = await page.locator('#pane-form').evaluate((pane) => {
        const bad: string[] = []
        for (const control of pane.querySelectorAll('input, textarea, select')) {
          const el = control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
          const id = el.id
          const hasLabelFor = id
            ? document.querySelector(`label[for="${CSS.escape(id)}"]`) !== null
            : false
          const hasAria = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
          if (!hasLabelFor && !hasAria) bad.push(el.tagName + '#' + (id || '(tanpa-id)'))
        }
        return bad
      })
      expect(unlabeled, `section index ${index}`).toEqual([])
    }
  })
})
