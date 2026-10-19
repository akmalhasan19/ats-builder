import type { AtsTarget } from './types'

/**
 * T7.4 — aksi `Perbaiki →`. Urutannya: tutup drawer bila ia menutupi layar,
 * buka bagian yang benar di rail, pindah ke tab form bila sedang di pratinjau,
 * lalu gulir + fokus field dan kilatkan `--cyanotype-wash` 600ms (§5.6).
 */

export type FocusDeps = {
  setActiveSection: (sectionId: string) => void
  setActiveTab: (tab: 'form' | 'preview') => void
  closeDrawer: () => void
  /** Di bawah 1280px drawer menutupi seluruh layar, jadi harus ditutup dulu. */
  shouldCloseDrawer: boolean
}

const FLASH_CLASS = 'ats-field-flash'
const FLASH_MS = 600

const flash = (element: HTMLElement): void => {
  const shell = element.closest<HTMLElement>('[data-field-shell]') ?? element
  shell.classList.add(FLASH_CLASS)
  window.setTimeout(() => shell.classList.remove(FLASH_CLASS), FLASH_MS)
}

/** Kartu entri diciutkan kecuali yang pertama — buka dulu sebelum mencari field. */
const expandEntry = (entryId: string): void => {
  const card = document.querySelector<HTMLElement>(`[data-entry-id="${entryId}"]`)
  const header = card?.querySelector<HTMLElement>('[role="button"][aria-expanded="false"]')
  header?.click()
}

export function focusTarget(target: AtsTarget | undefined, deps: FocusDeps): void {
  if (!target) return

  if (deps.shouldCloseDrawer) deps.closeDrawer()
  deps.setActiveSection(target.sectionId)
  deps.setActiveTab('form')

  // Field lahir dari render baru (bagian aktif bisa saja berubah), jadi pencarian
  // elemen diulang beberapa frame sampai React selesai menulis DOM. Tanpa ini,
  // satu frame terlalu cepat membuat fokus jatuh ke fallback tanpa field.
  const MAX_FRAMES = 20
  const attempt = (frame: number): void => {
    const element = target.field ? document.getElementById(target.field) : null
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      element.focus({ preventScroll: true })
      flash(element)
      return
    }
    if (frame === 0 && target.entryId) expandEntry(target.entryId)
    if (frame >= MAX_FRAMES) {
      document.getElementById('pane-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return
    }
    window.requestAnimationFrame(() => attempt(frame + 1))
  }

  window.requestAnimationFrame(() => attempt(0))
}
