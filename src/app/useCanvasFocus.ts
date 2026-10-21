import { useEffect, useRef } from 'react'
import { useUiStore, type EditMode } from '@/store/uiStore'
import { useCanvasFull } from './useCanvasFull'

/**
 * FASE 13 — D13 — fokus tidak boleh tersesat saat pane disembunyikan.
 *
 * Rail & panel formulir disembunyikan dengan utility `hidden` (D3), jadi
 * elemen yang sedang difokuskan ikut hilang dari document. Tanpa penanganan,
 * fokus jatuh ke `<body>` dan pengguna keyboard tersesat di tengah dokumen.
 *
 * Aturannya:
 *  - **masuk mode kanvas** → fokus pindah ke `#pane-preview` (kertas jadi
 *    satu-satunya area kerja; `tabIndex={-1}` membuatnya bisa difokuskan);
 *  - **keluar mode kanvas** → fokus kembali ke "pemicu"-nya. Pemicu disimpan
 *    saat masuk, tapi sering sudah lekang dari DOM (radio "Langsung di CV"
 *    di dalam popover yang ditutup), jadi ada rantai cadangan: elemen yang
 *    disimpan → pemicu menu Tampilan → `#pane-preview`.
 *  - **hanya tata letak layar penuh yang berubah** (tombol "Keluar" atau
 *    toggle "Kertas layar penuh") → fokus yang hilang dipulihkan, dan fokus
 *    yang masih hidup tidak diganggu (mis. switch di dalam popover).
 *
 * Run pertama sengaja diabaikan: memuat halaman dengan preferensi
 * `canvasFullscreen` tersimpan tidak boleh mencuri fokus sebelum pengguna
 * menyentuh apa pun.
 */

/** Elemen yang bisa difokuskan dan masih terlihat. */
const isVisible = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false
  if (typeof el.checkVisibility === 'function') return el.checkVisibility()
  // Fallback untuk lingkungan tanpa `checkVisibility` (mis. jsdom):
  // telusuri rantai ancestor, cari satu yang `display: none`.
  let node: HTMLElement | null = el
  while (node) {
    const view = node.ownerDocument.defaultView
    if (view && view.getComputedStyle(node).display === 'none') return false
    node = node.parentElement
  }
  return true
}

/** Pindahkan fokus tanpa menggulir halaman. */
const focusQuietly = (el: HTMLElement | null): void => {
  el?.focus({ preventScroll: true })
}

export function useCanvasFocus(): void {
  const editMode = useUiStore((state) => state.editMode)
  const canvasFull = useCanvasFull()
  const previous = useRef<{ editMode: EditMode; canvasFull: boolean } | null>(null)
  const trigger = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = { editMode, canvasFull }
    if (!before) return

    const preview = document.getElementById('pane-preview')
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null

    /** Kembalikan fokus ke pemicu, atau ke cadangan yang masih ada. */
    const restore = (): void => {
      const saved = trigger.current
      if (saved && saved.isConnected && isVisible(saved)) {
        focusQuietly(saved)
        return
      }
      const menu = document.querySelector<HTMLElement>('[data-probe="tampilan-menu"]')
      if (menu) {
        focusQuietly(menu)
        return
      }
      focusQuietly(preview)
    }

    if (before.editMode !== editMode) {
      if (editMode === 'canvas') {
        // Simpan elemen yang sedang fokus supaya fokus bisa kembali ke pemicu.
        trigger.current = active && active !== document.body ? active : null
        focusQuietly(preview)
      } else {
        restore()
        trigger.current = null
      }
      return
    }

    if (before.canvasFull !== canvasFull) {
      // Fokus hilang kalau elemen yang difokuskan ikut jadi `display:none`
      // (rail/formulir) atau ikut ter-unmount (tombol "Keluar").
      if (!active || active === document.body || !isVisible(active)) {
        restore()
      }
    }
  }, [editMode, canvasFull])
}
