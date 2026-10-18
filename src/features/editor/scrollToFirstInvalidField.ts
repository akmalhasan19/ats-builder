/**
 * T3.7 — gulir & fokus ke field invalid pertama di Form Pane.
 *
 * Dipanggil saat pengguna mencoba export dengan data belum valid. Tombol
 * Download baru aktif di Fase 5 (T5.2); sejak saat itu tombol itu memanggil
 * fungsi ini sebelum membuat PDF.
 */
export function scrollToFirstInvalidField(root: ParentNode = document): HTMLElement | null {
  const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!invalid) return null
  if (typeof invalid.scrollIntoView === 'function') {
    invalid.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  if (typeof invalid.focus === 'function') {
    invalid.focus({ preventScroll: true })
  }
  return invalid
}
