import type { CSSProperties } from 'react'

/**
 * Gaya tombol segmen kanvas: tombol harus membacanya persis seperti teks
 * dokumen yang diganti (P3 — tidak ada surface baru di atas kertas), jadi
 * gaya bawaan `<button>` dinetralkan dan tipografi diwarisi dari bloknya.
 *
 * Dipakai bersama oleh segmen biasa (`CanvasBlock`) dan pemicu popover tanggal
 * (`CanvasDatesEditor`) — keduanya tombol `<button type="button">` sesuai D11.
 */
export const CANVAS_BUTTON_RESET: CSSProperties = {
  appearance: 'none',
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  display: 'inline',
  font: 'inherit',
  textAlign: 'inherit',
  cursor: 'text',
  borderRadius: 2,
}
